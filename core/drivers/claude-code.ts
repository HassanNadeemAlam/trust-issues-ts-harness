import { spawn } from "node:child_process";
import type { Driver, DriverTurn, Message, ToolSpec } from "../types.ts";

/** Runs a prompt through a CLI and returns stdout. Injected in tests. */
export type CliRunner = (args: string[], stdin: string) => Promise<string>;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    text: { type: "string" },
    tool_calls: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, args: { type: "object", additionalProperties: true } },
        required: ["name", "args"],
      },
    },
  },
  required: ["tool_calls"],
};

export const spawnRunner: CliRunner = (args, stdin) =>
  new Promise((resolve, reject) => {
    const child = spawn("claude", args, { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (err += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`claude exited ${code}: ${err.slice(0, 300)}`))));
    child.stdin.end(stdin);
  });

/** Renders the neutral conversation as text; Claude Code's own tools are disabled, so tool use is structured output. */
export function renderPrompt(messages: Message[], tools: ToolSpec[]): string {
  const toolList = tools.map((t) => `- ${t.name}: ${t.description}\n  args schema: ${JSON.stringify(t.parameters)}`).join("\n");
  const convo = messages
    .map((m) => {
      if (m.role === "tool") return `[tool result ${m.toolCallId}]\n${m.text ?? ""}`;
      if (m.role === "assistant")
        return `[you]\n${m.text ?? ""}${(m.toolCalls ?? []).map((c) => `\ncalled ${c.id} ${c.name} ${JSON.stringify(c.args)}`).join("")}`;
      return `[user]\n${m.text ?? ""}`;
    })
    .join("\n\n");
  return `Available tools:\n${toolList}\n\nConversation so far:\n${convo}\n\nReply with your next step as JSON: optional "text" and the "tool_calls" to make now (empty array only if you are completely done).`;
}

/**
 * Claude via the Claude Code CLI in headless mode, using the user's Claude Code login instead of an API key.
 * Each turn is a fresh `claude -p`; the harness owns the conversation and the tools.
 */
export function claudeCodeDriver(opts: { model?: string; runner?: CliRunner } = {}): Driver {
  const run = opts.runner ?? spawnRunner;
  let seq = 0;
  return {
    name: "claude-code",
    async complete(system, messages, tools): Promise<DriverTurn> {
      const args = [
        "-p",
        "--output-format", "json",
        "--tools", "",
        "--no-session-persistence",
        "--setting-sources", "",
        "--system-prompt", system,
        "--json-schema", JSON.stringify(OUTPUT_SCHEMA),
        ...(opts.model ?? process.env.CLAUDE_CODE_MODEL ? ["--model", (opts.model ?? process.env.CLAUDE_CODE_MODEL)!] : []),
      ];
      const raw = await run(args, renderPrompt(messages, tools));
      const env = JSON.parse(raw) as {
        is_error?: boolean;
        result?: string;
        structured_output?: { text?: string; tool_calls?: Array<{ name: string; args: Record<string, unknown> }> };
        usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
      };
      if (env.is_error) throw new Error(`claude-code: ${String(env.result).slice(0, 300)}`);
      const out = env.structured_output ?? (JSON.parse(env.result ?? "{}") as NonNullable<typeof env.structured_output>);
      const toolCalls = (out.tool_calls ?? []).map((c) => ({ id: `cc_${seq++}`, name: c.name, args: c.args ?? {} }));
      const u = env.usage ?? {};
      return {
        message: { role: "assistant", ...(out.text ? { text: out.text } : {}), ...(toolCalls.length ? { toolCalls } : {}) },
        usage: {
          inputTokens: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
          outputTokens: u.output_tokens ?? 0,
        },
      };
    },
  };
}
