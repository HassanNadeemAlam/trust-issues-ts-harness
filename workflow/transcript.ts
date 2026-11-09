import { existsSync, readFileSync } from "node:fs";

export interface TypedTurn {
  uuid?: string;
  ts: string;
  text: string;
}

/** Text Claude Code injects into user-role entries. None of it is something a human typed. */
const INJECTED = /^\s*(<(command-|local-command|system-reminder|user-prompt-submit-hook|bash-|task-notification)|Stop hook feedback|\[Request interrupted|Caveat: The messages below)/i;

/**
 * Turns a human typed into the session. Excluded: assistant text, tool results (which arrive as user-role entries
 * carrying tool_result blocks), meta/compact entries and hook or harness injections.
 */
export function typedTurns(transcriptPath: string): TypedTurn[] {
  if (!existsSync(transcriptPath)) return [];
  const out: TypedTurn[] = [];
  for (const line of readFileSync(transcriptPath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let e: {
      type?: string;
      uuid?: string;
      timestamp?: string;
      isMeta?: boolean;
      isCompactSummary?: boolean;
      toolUseResult?: unknown;
      message?: { role?: string; content?: unknown };
    };
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (e.type !== "user" || e.message?.role !== "user" || e.isMeta || e.isCompactSummary || e.toolUseResult !== undefined) continue;
    const c = e.message.content;
    let text: string | undefined;
    if (typeof c === "string") text = c;
    else if (Array.isArray(c)) {
      if (c.some((b: { type?: string }) => b?.type === "tool_result")) continue;
      text = c.filter((b: { type?: string }) => b?.type === "text").map((b: { text?: string }) => b.text ?? "").join("\n");
    }
    if (!text?.trim() || INJECTED.test(text)) continue;
    out.push({ uuid: e.uuid, ts: e.timestamp ?? "", text: text.trim() });
  }
  return out;
}

const NEGATION = /\b(no|not|don'?t|do not|wait|hold|stop|reject|change|but)\b/i;
const YES = /\b(yes|approved?|agreed?|lgtm|go ahead|ship it|sounds good|signed off|confirm(ed)?)\b/i;

/** A yes in the stakeholder's own words: an approval word, and no negation or condition in the same turn. */
export function isApproval(text: string): boolean {
  return YES.test(text) && !NEGATION.test(text);
}

export function approvalAfter(transcriptPath: string, sinceIso: string): TypedTurn | undefined {
  return typedTurns(transcriptPath).find((t) => t.ts > sinceIso && isApproval(t.text));
}
