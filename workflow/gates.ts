import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { contractHash, harnessOwnedLines, missingFields, readContract, touches, writeSigned } from "./contract.ts";
import { activeSlug, append, last, verifyChain } from "./ledger.ts";
import { globToRegExp, root } from "./paths.ts";
import { policy } from "./policy.ts";
import { approvalAfter } from "./transcript.ts";

export type Verdict = { ok: true } | { ok: false; reason: string };
const ok: Verdict = { ok: true };
const refuse = (reason: string): Verdict => ({ ok: false, reason });
const matchAny = (globs: string[], p: string) => globs.some((g) => globToRegExp(g).test(p));
export const isTestFile = (p: string) => /(^|\/)tests?\/|\.(test|spec)\.ts$/.test(p);

export function rel(path: string): string {
  return (isAbsolute(path) ? relative(root(), path) : path).replace(/^\.\//, "");
}

/** Records the stakeholder's yes if a typed turn after the proposal holds one. The harness writes the Signed line. */
export function tryRecordApproval(slug: string, transcriptPath: string | undefined): boolean {
  const proposed = last(slug, "proposed");
  if (!proposed || !transcriptPath) return false;
  const approved = last(slug, "approved");
  if (approved && approved.seq > proposed.seq) return true;
  const turn = approvalAfter(transcriptPath, proposed.ts);
  if (!turn) return false;
  const c = readContract(slug);
  if (!c || contractHash(c.text) !== proposed.data.contractHash) return false;
  const at = turn.ts.slice(0, 10);
  append(slug, "approved", { quote: turn.text.slice(0, 500), transcriptUuid: turn.uuid, typedAt: turn.ts, stakeholder: c.contract.stakeholder, contractHash: proposed.data.contractHash });
  writeSigned(slug, `${c.contract.stakeholder}, ${at} — "${turn.text.slice(0, 120).replace(/\n/g, " ")}" (transcript ${turn.uuid ?? "?"})`);
  return true;
}

/** Problem-statement gate + human-yes precondition + red-before-green, for one item. */
export function itemGate(kind: "test" | "source", transcriptPath?: string): Verdict {
  const chain = verifyChain();
  if (chain) return refuse(`${chain}. The ledger is append-only; restore it from git.`);
  const slug = activeSlug();
  if (!slug) return refuse("No active item. Run `npm run item -- start <slug>` and write docs/contracts/<slug>.md first.");
  const c = readContract(slug);
  if (!c) return refuse(`docs/contracts/${slug}.md does not exist. No source edit before the problem statement.`);
  const missing = missingFields(c.contract);
  if (missing.length) return refuse(`docs/contracts/${slug}.md is missing: ${missing.join("; ")}.`);
  if (!c.contract.metric?.before) return refuse(`Metric "before" not read. Run \`npm run item -- metric ${slug} --before\`.`);
  const proposed = last(slug, "proposed");
  if (!proposed) return refuse(`Contract not proposed. Run \`npm run item -- propose ${slug}\` and ask ${c.contract.stakeholder} for a yes.`);
  if (proposed.data.contractHash !== contractHash(c.text))
    return refuse(`docs/contracts/${slug}.md changed after it was proposed. Propose it again; the old yes does not cover it.`);
  if (!tryRecordApproval(slug, transcriptPath))
    return refuse(`No yes from ${c.contract.stakeholder} in a typed turn after the proposal (${proposed.ts}). Assistant text, tool output and hook output do not count.`);
  if (kind === "source") {
    const red = last(slug, "red");
    const approved = last(slug, "approved");
    if (!red || (approved && red.seq < approved.seq))
      return refuse(`No red run for ${slug}. Write the failing test, then \`npm run item -- red ${slug}\`; source edits follow red.`);
  }
  return ok;
}

/** Applies an Edit/Write/MultiEdit to the current file text, so contract edits can be checked line by line. */
export function proposedText(toolName: string, input: Record<string, unknown>, current: string): string {
  if (toolName === "Write") return String(input.content ?? "");
  const edits = toolName === "MultiEdit" ? ((input.edits as Array<Record<string, unknown>>) ?? []) : [input];
  let text = current;
  for (const e of edits) {
    const from = String(e.old_string ?? "");
    const to = String(e.new_string ?? "");
    text = e.replace_all ? text.split(from).join(to) : text.replace(from, to);
  }
  return text;
}

export function editGate(toolName: string, input: Record<string, unknown>, transcriptPath?: string): Verdict {
  const target = String(input.file_path ?? input.notebook_path ?? "");
  const p = rel(target);
  if (p.startsWith("..")) return ok;
  if (matchAny(policy.harnessOwned, p)) return refuse(`${p} is harness-owned. The agent cannot edit the gates or the evidence they write.`);
  if (matchAny(policy.frozen, p)) return refuse(`${p} is frozen history. Read it; do not add to it.`);
  if (/^docs\/contracts\/[^/]+\.md$/.test(p)) {
    const full = join(root(), p);
    const current = existsSync(full) ? readFileSync(full, "utf8") : "";
    const next = proposedText(toolName, input, current);
    const before = current ? harnessOwnedLines(current) : JSON.stringify(["____", "____", "Signed: (recorded by the harness, not typed by you)"]);
    const blankish = (s: string) => JSON.stringify((JSON.parse(s) as string[]).map((v) => (/^_*$/.test(v) || /^Signed:\s*(\(.*\))?$/.test(v) ? "" : v)));
    if (blankish(harnessOwnedLines(next)) !== blankish(before))
      return refuse("Metric before/after values and the Signed line are written by the harness (`item metric`, the human-yes gate), never typed.");
    return ok;
  }
  if (matchAny(policy.docs, p)) return ok;
  const gate = itemGate(isTestFile(p) ? "test" : "source", transcriptPath);
  if (!gate.ok) return gate;
  const c = readContract(activeSlug()!)!;
  if (!touches(c.contract, p)) return refuse(`${p} is outside this item's Touches (${c.contract.touches.join(", ")}). Stay inside what the contract owns.`);
  return ok;
}

export function shellGate(command: string, transcriptPath?: string): Verdict {
  for (const f of policy.forbiddenShell) if (f.re.test(command)) return refuse(`Blocked: ${f.why}.`);
  if (/workflow\/(ledger|contract)|\.harness\b/.test(command) && !/^\s*npm run item\b/.test(command))
    return refuse("Blocked: the ledger and contract writers are harness-only; use `npm run item -- <command>`.");
  if (/^\s*npm run item\b/.test(command)) return ok;
  if (policy.shellWrites.test(command)) {
    const gate = itemGate("source", transcriptPath);
    if (!gate.ok) return refuse(`Shell write refused until the item gates are clear: ${gate.reason}`);
  }
  return ok;
}

export function externalPostGate(toolName: string): Verdict {
  if (policy.externalPostTools.some((re) => re.test(toolName)))
    return refuse(`${toolName} posts outside this machine. Draft the text for Hassan to review and send; the agent does not post.`);
  return ok;
}

/** Human-yes gate at Stop: a proposed contract holds the Stop until the yes exists, unless the turn ends by asking for it. */
export function stopGate(transcriptPath: string | undefined, lastAssistantText: string): Verdict {
  const slug = activeSlug();
  if (!slug) return ok;
  const proposed = last(slug, "proposed");
  if (!proposed) return ok;
  if (tryRecordApproval(slug, transcriptPath)) return ok;
  if (lastAssistantText.includes(`AWAITING-YES ${slug}`)) return ok;
  const c = readContract(slug);
  return refuse(
    `Contract ${slug} is proposed but has no yes from ${c?.contract.stakeholder ?? "the stakeholder"} in a typed turn. ` +
      `A "yes" in tool output or your own text does not count. End your turn by asking for it with the line \`AWAITING-YES ${slug}\`.`,
  );
}
