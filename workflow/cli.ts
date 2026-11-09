import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkOutcome } from "../checks/check_outcome.ts";
import { CONTRACT_TEMPLATE, contractHash, missingFields, readContract, writeMetricValue } from "./contract.ts";
import { activeSlug, append, eventsFor, last, readLedger, setActive, verifyChain } from "./ledger.ts";
import { contractPath, root } from "./paths.ts";
import { sh, tail } from "./run.ts";

const [cmd, slugArg, ...flags] = process.argv.slice(2);
const has = (f: string) => flags.includes(f);

function need(slug: string | undefined): string {
  if (!slug) throw new Error("slug required");
  const chain = verifyChain();
  if (chain) throw new Error(chain);
  return slug;
}

function refuse(slug: string, reason: string): never {
  append(slug, "refused", { cmd, reason });
  throw new Error(`REFUSED: ${reason}`);
}

function contractOrRefuse(slug: string) {
  const c = readContract(slug);
  if (!c) refuse(slug, `docs/contracts/${slug}.md does not exist`);
  const missing = missingFields(c.contract);
  if (missing.length) refuse(slug, `contract missing: ${missing.join("; ")}`);
  return c;
}

/** The yes on record must cover the contract as it stands now. */
function approvedContract(slug: string) {
  const c = contractOrRefuse(slug);
  const approved = last(slug, "approved");
  if (!approved) refuse(slug, "no recorded stakeholder yes");
  if (approved.data.contractHash !== contractHash(c.text)) refuse(slug, "the contract changed after the yes; propose it again");
  return c;
}

/** Fingerprint of the working tree, so ship can prove nothing changed after proof. */
function treeFingerprint(): string {
  const diff = sh("git add -A -n . && git diff HEAD && git ls-files --others --exclude-standard", { allowFail: true }).out;
  return createHash("sha256").update(diff.replace(/^.*\.harness\/.*$/gm, "")).digest("hex").slice(0, 16);
}

function readMetric(slug: string, command: string): string {
  const r = sh(command, { allowFail: true });
  const value = r.out.trim().split(/\s+/).pop() ?? "";
  if (r.code !== 0 || !/^-?\d+(\.\d+)?%?$/.test(value)) refuse(slug, `metric command did not print a number (exit ${r.code}): ${tail(r.out, 5)}`);
  return value;
}

const commands: Record<string, () => void> = {
  start() {
    const slug = need(slugArg);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error("slug must be kebab-case");
    mkdirSync(join(root(), "docs/contracts"), { recursive: true });
    if (!existsSync(contractPath(slug))) writeFileSync(contractPath(slug), CONTRACT_TEMPLATE(slug));
    setActive(slug);
    append(slug, "started");
    console.log(`active: ${slug}\nfill docs/contracts/${slug}.md, then: npm run item -- metric ${slug} --before`);
  },

  metric() {
    const slug = need(slugArg);
    const c = contractOrRefuse(slug);
    const phase = has("--after") ? "after" : has("--before") ? "before" : refuse(slug, "pass --before or --after");
    if (phase === "before" && last(slug, "approved")) refuse(slug, "before is read before the contract is approved");
    if (phase === "after") {
      const shipped = last(slug, "shipped");
      if (!shipped) refuse(slug, "not shipped; there is no merge to measure after");
      const pr = JSON.parse(sh(`gh pr view ${String(shipped.data.pr)} --json state,mergedAt,mergedBy,url`).out) as { state: string; mergedAt: string; mergedBy?: { login: string } };
      if (pr.state !== "MERGED") refuse(slug, `PR is ${pr.state}; a human merges it before the after reading`);
      if (!last(slug, "merged")) append(slug, "merged", { mergedAt: pr.mergedAt, mergedBy: pr.mergedBy?.login });
      sh("git fetch -q origin && git checkout -q main && git pull -q --ff-only", { allowFail: true });
    }
    const value = readMetric(slug, c.contract.metricCommand!);
    append(slug, "metric", { phase, value, command: c.contract.metricCommand });
    writeMetricValue(slug, phase, value);
    console.log(`${c.contract.metric!.name} ${phase}: ${value}`);
  },

  propose() {
    const slug = need(slugArg);
    const c = contractOrRefuse(slug);
    if (!c.contract.metric?.before) refuse(slug, `read the metric first: npm run item -- metric ${slug} --before`);
    append(slug, "proposed", { contractHash: contractHash(c.text), stakeholder: c.contract.stakeholder });
    console.log(`${c.text.trim()}\n\nAWAITING-YES ${slug}: ${c.contract.stakeholder}, please reply in your own words if you agree to this contract.`);
  },

  red() {
    const slug = need(slugArg);
    const c = approvedContract(slug);
    const r = sh(c.contract.test, { allowFail: true });
    if (r.code === 0) refuse(slug, `\`${c.contract.test}\` passed. A red run needs a failing test that encodes a Scenario.`);
    append(slug, "red", { command: c.contract.test, exit: r.code, tail: tail(r.out) });
    console.log(`RED recorded (exit ${r.code}). Source edits are now allowed inside Touches.\n${tail(r.out, 12)}`);
  },

  proof() {
    const slug = need(slugArg);
    const c = approvedContract(slug);
    if (!last(slug, "red")) refuse(slug, "no red run");
    const steps: Array<[string, string]> = [
      ["type-check", "npm run --silent type-check"],
      ["item tests", c.contract.test],
      ["suite", "npx vitest run"],
      ["standards", "npm run --silent check -- apps/todo-api"],
      ["secrets", "! (git diff HEAD -U0; git ls-files --others --exclude-standard -z | xargs -0 cat 2>/dev/null) | grep -nE '(sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{32,}|ghp_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY)'"],
      ["no .env", "! git ls-files --others --exclude-standard --cached | grep -E '(^|/)\\.env($|\\.)' | grep -v '.env.example'"],
    ];
    const results = steps.map(([name, command]) => {
      const r = sh(command, { allowFail: true });
      return { name, status: r.code === 0 ? "PASS" : "FAIL", tail: r.code === 0 ? "" : tail(r.out, 10) };
    });
    results.forEach((r) => console.log(`${r.status} ${r.name}${r.tail ? `\n${r.tail}` : ""}`));
    if (results.some((r) => r.status !== "PASS")) refuse(slug, `proof failed: ${results.filter((r) => r.status !== "PASS").map((r) => r.name).join(", ")}`);
    append(slug, "proof", { results: results.map(({ name, status }) => ({ name, status })), tree: treeFingerprint() });
    console.log(`PROOF clear for ${slug}`);
  },

  ship() {
    const slug = need(slugArg);
    const c = approvedContract(slug);
    const proof = last(slug, "proof");
    if (!proof) refuse(slug, "no proof clearance");
    if (proof.data.tree !== treeFingerprint()) refuse(slug, "the tree changed after proof; run proof again");
    if (sh("git remote get-url origin", { allowFail: true }).code !== 0) refuse(slug, "no `origin` remote to push the feature branch to");
    const branch = `item/${slug}`;
    if (/^(main|master|release\/)/.test(branch)) refuse(slug, "ship only pushes feature branches");
    const statusLine = `| ${slug} | ${c.contract.problem!.slice(0, 80)} | shipped, awaiting human merge | [contract](contracts/${slug}.md) |\n`;
    const index = join(root(), "docs/ticket-status.md");
    if (!existsSync(index)) writeFileSync(index, "# Item status\n\n| Item | Problem | Status | Contract |\n| --- | --- | --- | --- |\n");
    appendFileSync(index, statusLine);
    sh(`git checkout -q -B ${branch}`);
    sh("git add -A");
    sh(`git -c core.hooksPath=/dev/null commit -q -m ${JSON.stringify(`feat(${slug}): ${c.contract.scenarios[0]!.then}\n\nContract: docs/contracts/${slug}.md\nStakeholder yes: ${String(last(slug, "approved")?.data.quote ?? "").slice(0, 120)}`)}`);
    sh(`git push -q -u origin ${branch}`);
    const body: string = [
      `## ${slug}`,
      `**Problem:** ${c.contract.problem}`,
      `**Owner:** ${c.contract.owner} · **Stakeholder:** ${c.contract.stakeholder}`,
      `**Metric:** ${c.contract.metric!.name}, ${c.contract.metric!.window}, before ${c.contract.metric!.before}`,
      "",
      ...c.contract.scenarios.map((s) => `- WHEN ${s.when} THEN ${s.then}`),
      "",
      `**Not included:** ${c.contract.notIncluded}`,
      "",
      "### Harness record",
      ...eventsFor(slug).filter((e) => e.event !== "refused").map((e) => `- \`${e.ts}\` ${e.event}${e.event === "approved" ? `: "${String(e.data.quote).slice(0, 120)}"` : ""}`),
      "",
      "Merge is a human decision. After merging, run `npm run item -- metric " + slug + " --after` and `npm run item -- close " + slug + "`.",
      "",
      "🤖 Generated with [Claude Code](https://claude.com/claude-code)",
    ].join("\n");
    const bodyFile = join(root(), ".harness", `pr-${slug}.md`);
    writeFileSync(bodyFile, body);
    const pr = sh(`gh pr create --base main --head ${branch} --title ${JSON.stringify(`${slug}: ${c.contract.scenarios[0]!.then}`.slice(0, 120))} --body-file ${JSON.stringify(bodyFile)}`);
    const url = pr.out.trim().split("\n").pop()!;
    append(slug, "shipped", { branch, pr: url });
    sh("git checkout -q main");
    console.log(`PR opened: ${url}\nA human merges it. Then: npm run item -- metric ${slug} --after`);
  },

  close() {
    const slug = need(slugArg);
    const reasons = checkOutcome(slug);
    if (reasons.length) refuse(slug, `cannot close: ${reasons.join("; ")}`);
    const c = readContract(slug)!;
    append(slug, "closed", { before: c.contract.metric!.before, after: c.contract.metric!.after });
    if (activeSlug() === slug) setActive(undefined);
    console.log(`CLOSED ${slug}: ${c.contract.metric!.name} ${c.contract.metric!.before} → ${c.contract.metric!.after}`);
  },

  status() {
    const slugs = slugArg ? [slugArg] : [...new Set(readLedger().map((e) => e.slug))];
    console.log(`active: ${activeSlug() ?? "-"}   ledger: ${verifyChain() ?? "chain ok"}`);
    for (const s of slugs) console.log(`${s}: ${eventsFor(s).filter((e) => e.event !== "refused").map((e) => e.event).join(" → ")}`);
  },

  /** Draft of the Teams message I post after shipping; printed, never sent. */
  teams() {
    const slug = need(slugArg);
    const pr = last(slug, "shipped")?.data.pr;
    console.log(`Ticket: docs/contracts/${slug}.md\nPR [sf-harness-hsn]: ${pr ? String(pr) : "(not shipped)"}`);
  },
};

try {
  const run = commands[cmd ?? ""];
  if (!run) {
    console.log(`usage: npm run item -- <${Object.keys(commands).join("|")}> <slug> [--before|--after]`);
    process.exit(cmd ? 1 : 0);
  }
  run();
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
