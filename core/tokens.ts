import type { Message } from "./types.ts";

/** Provider-neutral token estimate (≈4 chars/token). Used for the baseline and when a provider reports no usage. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function messagesTokens(system: string, messages: Message[]): number {
  return estimateTokens(system) + messages.reduce((n, m) => n + estimateTokens(JSON.stringify(m)), 0);
}

export interface TokenReport {
  driver: string;
  turns: number;
  /** Input tokens billed by the provider (or estimated), summed over turns. */
  input: number;
  output: number;
  /** Harness-supplied context (system, task, tool results) summed over turns. */
  contextFootprint: number;
  /** The same for an eager harness that inlines the whole workspace and all standards every turn. */
  eagerContextFootprint: number;
  /** 1 - contextFootprint / eagerContextFootprint, as a percentage. */
  reductionPct: number;
}

export function buildReport(driver: string, turns: number, input: number, output: number, footprint: number, eager: number): TokenReport {
  const reductionPct = eager === 0 ? 0 : Math.round((1 - footprint / eager) * 1000) / 10;
  return { driver, turns, input, output, contextFootprint: footprint, eagerContextFootprint: eager, reductionPct };
}
