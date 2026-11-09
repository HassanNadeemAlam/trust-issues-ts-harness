import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { activePath, harnessDir, ledgerPath } from "./paths.ts";

export type LedgerEvent = "started" | "metric" | "proposed" | "approved" | "red" | "proof" | "shipped" | "merged" | "closed" | "refused";

export interface Entry {
  seq: number;
  ts: string;
  slug: string;
  event: LedgerEvent;
  data: Record<string, unknown>;
  prev: string;
  hash: string;
}

const digest = (e: Omit<Entry, "hash">) => createHash("sha256").update(JSON.stringify(e)).digest("hex").slice(0, 16);

export function readLedger(): Entry[] {
  if (!existsSync(ledgerPath())) return [];
  return readFileSync(ledgerPath(), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Entry);
}

/** Append-only and hash-chained: a hand edit breaks the chain and every gate refuses until it is restored. */
export function verifyChain(entries = readLedger()): string | undefined {
  let prev = "genesis";
  for (const e of entries) {
    const { hash, ...rest } = e;
    if (e.prev !== prev || digest(rest) !== hash) return `ledger chain broken at seq ${e.seq}`;
    prev = hash;
  }
  return undefined;
}

export function append(slug: string, event: LedgerEvent, data: Record<string, unknown> = {}): Entry {
  mkdirSync(harnessDir(), { recursive: true });
  const entries = readLedger();
  const base = { seq: entries.length, ts: new Date().toISOString(), slug, event, data, prev: entries.at(-1)?.hash ?? "genesis" };
  const entry = { ...base, hash: digest(base) };
  appendFileSync(ledgerPath(), JSON.stringify(entry) + "\n");
  return entry;
}

export const eventsFor = (slug: string, entries = readLedger()) => entries.filter((e) => e.slug === slug);
export const last = (slug: string, event: LedgerEvent, entries = readLedger()) => eventsFor(slug, entries).filter((e) => e.event === event).at(-1);

export function activeSlug(): string | undefined {
  return existsSync(activePath()) ? readFileSync(activePath(), "utf8").trim() || undefined : undefined;
}

export function setActive(slug: string | undefined): void {
  mkdirSync(harnessDir(), { recursive: true });
  writeFileSync(activePath(), slug ?? "");
}
