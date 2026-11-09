import { estimateTokens } from "../tokens.ts";
import type { Message } from "../types.ts";

/**
 * Builds the window actually sent to the model. Tool results and written file bodies older than the last
 * `keepTurns` assistant turns are replaced by one-line stubs; the model can re-fetch anything just in time.
 * The full transcript is kept on disk by the engine.
 */
export function compactHistory(messages: Message[], keepTurns = 1): Message[] {
  const assistantIdx = messages.flatMap((m, i) => (m.role === "assistant" ? [i] : []));
  const cutoff = assistantIdx.length > keepTurns ? assistantIdx[assistantIdx.length - keepTurns]! : 0;
  return messages.map((m, i) => {
    if (i >= cutoff) return m;
    if (m.role === "tool" && (m.text?.length ?? 0) > 80)
      return { ...m, text: `[elided ${estimateTokens(m.text ?? "")} tokens; call the tool again if still needed]` };
    if (m.role === "assistant" && m.toolCalls?.some((c) => typeof c.args.content === "string"))
      return {
        ...m,
        toolCalls: m.toolCalls.map((c) =>
          typeof c.args.content === "string" ? { ...c, args: { ...c.args, content: `[elided ${c.args.content.split("\n").length} lines; read_file to view]` } } : c,
        ),
      };
    return m;
  });
}
