import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { contractPath, globToRegExp } from "./paths.ts";

export interface Scenario {
  when: string;
  then: string;
}

export interface Contract {
  slug: string;
  problem?: string;
  owner?: string;
  stakeholder?: string;
  metric?: { name: string; window: string; before?: string; after?: string };
  metricCommand?: string;
  scenarios: Scenario[];
  notIncluded?: string;
  touches: string[];
  test: string;
  signed?: string;
}

const field = (text: string, name: string) => {
  const m = new RegExp(`^${name}:[ \\t]*(.*)$`, "mi").exec(text);
  const v = m?.[1]?.trim();
  return v && !/^<.*>$/.test(v) && v !== "TODO" ? v : undefined;
};
const blank = (v: string | undefined) => (!v || /^_+$/.test(v) ? undefined : v);

export function parseContract(slug: string, text: string): Contract {
  const metricLine = field(text, "Metric");
  let metric: Contract["metric"];
  if (metricLine) {
    const m = /^(.*?),\s*(.*?)\s+before:\s*(\S*)\s+after:\s*(\S*)\s*$/i.exec(metricLine);
    metric = m ? { name: m[1]!.trim(), window: m[2]!.trim(), before: blank(m[3]), after: blank(m[4]) } : undefined;
  }
  const scenarios = [...text.matchAll(/^Scenario:\s*WHEN\s+(.+?)\s+THEN\s+(.+)$/gim)].map((m) => ({ when: m[1]!.trim(), then: m[2]!.trim() }))
    .filter((s) => !/<[^>]+>/.test(`${s.when} ${s.then}`));
  return {
    slug,
    problem: field(text, "Problem"),
    owner: field(text, "Owner"),
    stakeholder: field(text, "Stakeholder"),
    metric,
    metricCommand: field(text, "Metric command"),
    scenarios,
    notIncluded: field(text, "Not included"),
    touches: (field(text, "Touches") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    test: field(text, "Test") ?? "npx vitest run apps",
    signed: field(text, "Signed")?.startsWith("(") ? undefined : field(text, "Signed"),
  };
}

/** Field names the problem-statement gate requires, in the order a human fills them. */
export function missingFields(c: Contract): string[] {
  const missing: string[] = [];
  if (!c.problem) missing.push("Problem");
  if (!c.owner) missing.push("Owner");
  if (!c.stakeholder) missing.push("Stakeholder");
  if (!c.metric) missing.push("Metric (`<name>, <window>   before: ____   after: ____`)");
  if (!c.metricCommand) missing.push("Metric command");
  if (c.scenarios.length === 0) missing.push("Scenario (`WHEN <condition> THEN <observable result>`)");
  if (!c.notIncluded) missing.push("Not included");
  if (c.touches.length === 0) missing.push("Touches");
  return missing;
}

export function readContract(slug: string): { contract: Contract; text: string } | undefined {
  const p = contractPath(slug);
  if (!existsSync(p)) return undefined;
  const text = readFileSync(p, "utf8");
  return { contract: parseContract(slug, text), text };
}

/** Lines only the harness may write: metric values and the signature. */
export function harnessOwnedLines(text: string): string {
  const metric = /^Metric:.*$/im.exec(text)?.[0] ?? "";
  const values = /before:\s*(\S*)\s+after:\s*(\S*)/i.exec(metric);
  const signed = /^Signed:.*$/im.exec(text)?.[0] ?? "";
  return JSON.stringify([values?.[1] ?? "", values?.[2] ?? "", signed]);
}

/** Hash of what the stakeholder agreed to: everything except harness-owned values. */
export function contractHash(text: string): string {
  const normalized = text
    .replace(/(before:\s*)\S*/i, "$1")
    .replace(/(after:\s*)\S*/i, "$1")
    .replace(/^Signed:.*$/im, "Signed:")
    .replace(/\s+$/gm, "");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

export function touches(c: Contract, relPath: string): boolean {
  return c.touches.some((g) => globToRegExp(g).test(relPath));
}

/** Harness-only writers. */
export function writeMetricValue(slug: string, phase: "before" | "after", value: string): void {
  const p = contractPath(slug);
  const text = readFileSync(p, "utf8").replace(new RegExp(`(^Metric:.*?${phase}:\\s*)\\S*`, "im"), `$1${value}`);
  writeFileSync(p, text);
}

export function writeSigned(slug: string, line: string): void {
  const p = contractPath(slug);
  const text = readFileSync(p, "utf8");
  writeFileSync(p, /^Signed:.*$/im.test(text) ? text.replace(/^Signed:.*$/im, `Signed: ${line}`) : `${text.trimEnd()}\nSigned: ${line}\n`);
}

export const CONTRACT_TEMPLATE = (slug: string) => `# ${slug}

Problem: <what breaks, in the stakeholder's words, with evidence>
Owner: <team or person who pays for this>
Stakeholder: <the person whose typed yes approves this contract>
Metric: <name>, <window>   before: ____   after: ____
Metric command: <shell command that prints the metric as a single number>
Scenario: WHEN <condition> THEN <observable result>
Not included: <what you are deliberately not building>
Touches: <comma-separated globs this item may edit, e.g. apps/todo-api/src/**, apps/todo-api/tests/**>
Test: npx vitest run apps/todo-api
Signed: (recorded by the harness, not typed by you)
`;
