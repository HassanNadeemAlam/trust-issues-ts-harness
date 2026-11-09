// Outcome check: an item closes only when its metric was read after the merge and sits next to its before value.
import { pathToFileURL } from "node:url";
import { readContract } from "../workflow/contract.ts";
import { eventsFor, verifyChain } from "../workflow/ledger.ts";

export function checkOutcome(slug: string): string[] {
  const reasons: string[] = [];
  const chain = verifyChain();
  if (chain) return [chain];
  const c = readContract(slug);
  if (!c) return [`docs/contracts/${slug}.md does not exist`];
  const events = eventsFor(slug);
  const merged = events.filter((e) => e.event === "merged").at(-1);
  const before = events.filter((e) => e.event === "metric" && e.data.phase === "before").at(-1);
  const after = events.filter((e) => e.event === "metric" && e.data.phase === "after").at(-1);
  if (!events.some((e) => e.event === "approved")) reasons.push("no recorded stakeholder yes");
  if (!events.some((e) => e.event === "red")) reasons.push("no red run");
  if (!events.some((e) => e.event === "proof")) reasons.push("no proof clearance");
  if (!events.some((e) => e.event === "shipped")) reasons.push("not shipped through the harness");
  if (!merged) reasons.push("PR merge not confirmed (run `item metric <slug> --after`, which checks the merge)");
  if (!before) reasons.push(`metric "${c.contract.metric?.name ?? "?"}" has no before reading`);
  if (!after) reasons.push(`metric "${c.contract.metric?.name ?? "?"}" was not read after the merge`);
  if (merged && after && after.seq < merged.seq) reasons.push("after reading predates the merge");
  if (before && String(before.data.value) !== c.contract.metric?.before) reasons.push("contract `before` does not match the ledger reading");
  if (after && String(after.data.value) !== c.contract.metric?.after) reasons.push("contract `after` does not match the ledger reading");
  return reasons;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const slug = process.argv[2];
  if (!slug) {
    console.error("usage: tsx checks/check_outcome.ts <slug>");
    process.exit(1);
  }
  const reasons = checkOutcome(slug);
  console.log(reasons.length ? `REFUSED ${slug}:\n- ${reasons.join("\n- ")}` : `OK ${slug}: outcome recorded`);
  process.exit(reasons.length ? 1 : 0);
}
