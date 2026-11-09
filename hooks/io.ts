import { existsSync, readFileSync } from "node:fs";
import type { Verdict } from "../workflow/gates.ts";

export interface HookInput {
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  transcript_path?: string;
  stop_hook_active?: boolean;
  cwd?: string;
  prompt?: string;
}

export async function readInput(): Promise<HookInput> {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  return raw.trim() ? (JSON.parse(raw) as HookInput) : {};
}

/** PreToolUse: exit 2 blocks the call and shows the reason to the model. */
export function exitPreToolUse(v: Verdict): never {
  if (!v.ok) {
    process.stderr.write(`[sf-harness] ${v.reason}\n`);
    process.exit(2);
  }
  process.exit(0);
}

export function lastAssistantText(transcriptPath: string | undefined): string {
  if (!transcriptPath || !existsSync(transcriptPath)) return "";
  const lines = readFileSync(transcriptPath, "utf8").split("\n").filter(Boolean).reverse();
  for (const l of lines) {
    try {
      const e = JSON.parse(l) as { type?: string; message?: { content?: unknown } };
      if (e.type !== "assistant") continue;
      const c = e.message?.content;
      const text = Array.isArray(c) ? c.filter((b: { type?: string }) => b.type === "text").map((b: { text?: string }) => b.text ?? "").join("\n") : String(c ?? "");
      if (text.trim()) return text;
    } catch {
      continue;
    }
  }
  return "";
}
