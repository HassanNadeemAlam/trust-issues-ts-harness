import type { Driver, DriverTurn, Message, ToolSpec } from "../types.ts";

type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

export interface ClaudeOptions {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

/** Anthropic Messages API driver. Translates neutral messages ↔ content blocks. */
export function claudeDriver(opts: ClaudeOptions = {}): Driver {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  const model = opts.model ?? process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";
  const doFetch = opts.fetchImpl ?? fetch;

  const toWire = (messages: Message[]) => {
    const out: Array<{ role: "user" | "assistant"; content: Block[] }> = [];
    for (const m of messages) {
      const blocks: Block[] =
        m.role === "tool"
          ? [{ type: "tool_result", tool_use_id: m.toolCallId ?? "", content: m.text ?? "" }]
          : [
              ...(m.text ? [{ type: "text" as const, text: m.text }] : []),
              ...(m.toolCalls ?? []).map((c) => ({ type: "tool_use" as const, id: c.id, name: c.name, input: c.args })),
            ];
      const role = m.role === "assistant" ? "assistant" : "user";
      const last = out[out.length - 1];
      if (last && last.role === role) last.content.push(...blocks);
      else out.push({ role, content: blocks });
    }
    return out;
  };

  return {
    name: "claude",
    async complete(system, messages, tools: ToolSpec[]): Promise<DriverTurn> {
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
      const res = await doFetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model,
          max_tokens: 8192,
          system,
          messages: toWire(messages),
          tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })),
        }),
      });
      if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = (await res.json()) as { content: Block[]; usage: { input_tokens: number; output_tokens: number } };
      const text = data.content.filter((b): b is Extract<Block, { type: "text" }> => b.type === "text").map((b) => b.text).join("\n");
      const toolCalls = data.content
        .filter((b): b is Extract<Block, { type: "tool_use" }> => b.type === "tool_use")
        .map((b) => ({ id: b.id, name: b.name, args: b.input }));
      return {
        message: { role: "assistant", ...(text ? { text } : {}), ...(toolCalls.length ? { toolCalls } : {}) },
        usage: { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens },
      };
    },
  };
}
