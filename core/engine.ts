import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { compactHistory } from "./context/history.ts";
import { availableStandards, STANDARDS_DIR } from "./context/jit.ts";
import type { Registry } from "./registry.ts";
import { allPassed, runStandards, summarize, type CheckResult } from "./standards/index.ts";
import { buildReport, estimateTokens, messagesTokens, type TokenReport } from "./tokens.ts";
import type { Driver, Message, Task, Tool } from "./types.ts";
import { listFiles, prepareWorkspace } from "./workspace.ts";

export interface RunResult {
  workspace: string;
  finished: boolean;
  checks: CheckResult[];
  passed: boolean;
  tokens: TokenReport;
}

export interface RunOptions {
  runsDir?: string;
  runId?: string;
}

const SYSTEM = (standards: string[]) =>
  [
    "You build TypeScript REST APIs inside a workspace, using only the tools provided.",
    "Context is fetched just in time: call list_files/read_file/search for code and get_standard for rules.",
    `Standards: ${standards.join(", ")}. Read each before writing code.`,
    "Call run_checks after writing. Fix every FAIL. Call finish only when all checks PASS.",
  ].join("\n");

/** Harness-supplied context in the window: system, task and tool results. The model's own output is excluded. */
function contextTokens(system: string, messages: Message[]): number {
  return estimateTokens(system) + messages.filter((m) => m.role !== "assistant").reduce((n, m) => n + estimateTokens(m.text ?? ""), 0);
}

/** What an eager harness would supply this turn: the same, plus the full workspace and every standard inlined. */
function eagerContextTokens(system: string, messages: Message[], workspace: string): number {
  const repo = listFiles(workspace).map((p) => `// ${p}\n${readFileSync(join(workspace, p), "utf8")}`).join("\n");
  const standards = availableStandards().map((s) => readFileSync(join(STANDARDS_DIR, `${s}.md`), "utf8")).join("\n");
  return contextTokens(system, messages) + estimateTokens(repo) + estimateTokens(standards);
}

export async function runTask(task: Task, driver: Driver, registry: Registry, opts: RunOptions = {}): Promise<RunResult> {
  const runsDir = opts.runsDir ?? join(process.cwd(), "runs");
  const runDir = join(runsDir, opts.runId ?? `${task.id}-${Date.now()}`, driver.name);
  const workspace = prepareWorkspace(task.template, join(runDir, "workspace"));
  const transcript = join(runDir, "transcript.jsonl");
  mkdirSync(runDir, { recursive: true });

  let finished = false;
  const engineTools: Tool[] = [
    {
      name: "run_checks",
      description: "Run the standards checks (zod, rfc7807, types, plugins). Returns a compact PASS/FAIL summary.",
      schema: z.object({}),
      run: async () => summarize(await runStandards(workspace, task.probes, registry)),
    },
    {
      name: "finish",
      description: "Declare the task complete.",
      schema: z.object({ summary: z.string() }),
      run: () => {
        finished = true;
        return "ok";
      },
    },
  ];
  const tools = new Map([...registry.tools(), ...engineTools].map((t) => [t.name, t]));
  const specs = [...registry.toolSpecs(), ...engineTools.map((t) => ({ name: t.name, description: t.description, parameters: { type: "object", properties: t.name === "finish" ? { summary: { type: "string" } } : {}, required: t.name === "finish" ? ["summary"] : [] } }))];

  const system = SYSTEM(availableStandards());
  const messages: Message[] = [
    { role: "user", text: `Task ${task.id}: ${task.goal}\nAcceptance:\n${task.acceptance.map((a) => `- ${a}`).join("\n")}` },
  ];
  let actual = 0;
  let output = 0;
  let footprint = 0;
  let eagerFootprint = 0;
  let turns = 0;

  for (; turns < (task.maxTurns ?? 30) && !finished; turns++) {
    const window = compactHistory(messages);
    footprint += contextTokens(system, window);
    eagerFootprint += eagerContextTokens(system, messages, workspace);
    const { message, usage } = await driver.complete(system, window, specs);
    actual += usage.inputTokens || messagesTokens(system, window);
    output += usage.outputTokens;
    messages.push(message);
    appendFileSync(transcript, JSON.stringify(message) + "\n");
    if (!message.toolCalls?.length) break;
    for (const call of message.toolCalls) {
      const tool = tools.get(call.name);
      let result: string;
      if (!tool) result = `unknown tool ${call.name}`;
      else {
        const parsed = tool.schema.safeParse(call.args);
        try {
          result = parsed.success ? await tool.run(parsed.data, { workspace, registry }) : `invalid args: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`;
        } catch (e) {
          result = `error: ${(e as Error).message}`;
        }
      }
      const toolMsg: Message = { role: "tool", toolCallId: call.id, text: result };
      messages.push(toolMsg);
      appendFileSync(transcript, JSON.stringify(toolMsg) + "\n");
    }
  }

  const checks = await runStandards(workspace, task.probes, registry);
  const tokens = buildReport(driver.name, turns, actual, output, footprint, eagerFootprint);
  const result: RunResult = { workspace, finished, checks, passed: allPassed(checks), tokens };
  writeFileSync(join(runDir, "report.json"), JSON.stringify({ task: task.id, ...result }, null, 2));
  return result;
}
