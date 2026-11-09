import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { ToolCall } from "../../core/types.ts";

const GOOD = join(import.meta.dirname, "../fixtures/todo-good");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)]));
}

/** A fixed agent trajectory: explore just in time, read standards, write the reference solution, check, finish. */
export function scriptedTurns(): Array<Array<Omit<ToolCall, "id">>> {
  const writes = files(join(GOOD, "src"))
    .filter((f) => !f.endsWith("db.ts"))
    .map((f) => ({ name: "write_file", args: { path: relative(GOOD, f), content: readFileSync(f, "utf8") } }));
  return [
    [{ name: "list_files", args: {} }],
    [{ name: "read_file", args: { path: "README.md" } }, { name: "search", args: { pattern: "^\\s+\\w+\\(.*\\):" } }],
    [
      { name: "get_standard", args: { name: "api-contract" } },
      { name: "get_standard", args: { name: "zod" } },
      { name: "get_standard", args: { name: "rfc7807" } },
      { name: "get_standard", args: { name: "types" } },
    ],
    writes,
    [{ name: "run_checks", args: {} }],
    [{ name: "list_routes", args: {} }],
    [{ name: "finish", args: { summary: "Todo API implemented; all checks pass." } }],
  ];
}

/** Serves the trajectory over a provider's wire format. `turn` is derived from the request so both drivers stay stateless. */
export function mockProvider(kind: "claude" | "openai"): { fetchImpl: typeof fetch; requests: unknown[] } {
  const turns = scriptedTurns();
  const requests: unknown[] = [];
  const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { messages: Array<{ role: string }> };
    requests.push(body);
    const turn = body.messages.filter((m) => m.role === "assistant").length;
    const calls = (turns[turn] ?? []).map((c, i) => ({ ...c, id: `call_${turn}_${i}` }));
    const payload =
      kind === "claude"
        ? {
            content: calls.map((c) => ({ type: "tool_use", id: c.id, name: c.name, input: c.args })),
            usage: { input_tokens: 0, output_tokens: 10 },
          }
        : {
            choices: [{ message: { content: null, tool_calls: calls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.args) } })) } }],
            usage: { prompt_tokens: 0, completion_tokens: 10 },
          };
    return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { fetchImpl, requests };
}
