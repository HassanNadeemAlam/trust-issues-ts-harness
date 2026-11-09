import type { Driver, DriverTurn, Message, ToolSpec } from "../types.ts";

interface WireToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}
interface WireMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: WireToolCall[];
  tool_call_id?: string;
}

export interface OpenAIOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

/** OpenAI Chat Completions driver. Translates neutral messages ↔ function calls. */
export function openaiDriver(opts: OpenAIOptions = {}): Driver {
  const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
  const model = opts.model ?? process.env.OPENAI_MODEL ?? "gpt-5";
  const baseUrl = opts.baseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const doFetch = opts.fetchImpl ?? fetch;

  const toWire = (system: string, messages: Message[]): WireMessage[] => [
    { role: "system", content: system },
    ...messages.map((m): WireMessage => {
      if (m.role === "tool") return { role: "tool", tool_call_id: m.toolCallId ?? "", content: m.text ?? "" };
      if (m.role === "assistant")
        return {
          role: "assistant",
          content: m.text ?? null,
          ...(m.toolCalls?.length
            ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: "function" as const, function: { name: c.name, arguments: JSON.stringify(c.args) } })) }
            : {}),
        };
      return { role: "user", content: m.text ?? "" };
    }),
  ];

  return {
    name: "openai",
    async complete(system, messages, tools: ToolSpec[]): Promise<DriverTurn> {
      if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
      const res = await doFetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: toWire(system, messages),
          tools: tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })),
        }),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = (await res.json()) as {
        choices: Array<{ message: { content: string | null; tool_calls?: WireToolCall[] } }>;
        usage?: { prompt_tokens: number; completion_tokens: number };
      };
      const msg = data.choices[0]?.message;
      const toolCalls = (msg?.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function.name, args: JSON.parse(c.function.arguments || "{}") as Record<string, unknown> }));
      return {
        message: { role: "assistant", ...(msg?.content ? { text: msg.content } : {}), ...(toolCalls.length ? { toolCalls } : {}) },
        usage: { inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 },
      };
    },
  };
}
