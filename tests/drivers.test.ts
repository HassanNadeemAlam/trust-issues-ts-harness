import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadRegistry } from "../core/config.ts";
import { claudeDriver, openaiDriver } from "../core/drivers/index.ts";
import { runTask } from "../core/engine.ts";
import { loadTask } from "../core/task.ts";
import { listFiles } from "../core/workspace.ts";
import { mockProvider } from "./helpers/scripted.ts";

const runsDir = join(import.meta.dirname, "../runs/test-drivers");
const taskFile = join(import.meta.dirname, "../tasks/todo-api.task.json");
afterAll(() => rmSync(runsDir, { recursive: true, force: true }));

describe("model agnosticism", () => {
  it("runs the identical task file on Claude and OpenAI drivers with identical results", async () => {
    const registry = await loadRegistry();
    const task = loadTask(taskFile);
    const before = readFileSync(taskFile, "utf8");
    const claude = mockProvider("claude");
    const openai = mockProvider("openai");
    const a = await runTask(task, claudeDriver({ apiKey: "test", fetchImpl: claude.fetchImpl }), registry, { runsDir, runId: "agnostic" });
    const b = await runTask(task, openaiDriver({ apiKey: "test", fetchImpl: openai.fetchImpl }), registry, { runsDir, runId: "agnostic" });

    expect(readFileSync(taskFile, "utf8")).toBe(before);
    for (const r of [a, b]) {
      expect(r.finished).toBe(true);
      expect(r.passed).toBe(true);
    }
    const snapshot = (ws: string) => listFiles(ws).map((p) => [p, readFileSync(join(ws, p), "utf8")]);
    expect(snapshot(a.workspace)).toEqual(snapshot(b.workspace));
    expect(a.tokens.turns).toBe(b.tokens.turns);
  });

  it("translates tool results into each provider's wire format", async () => {
    const registry = await loadRegistry();
    const task = loadTask(taskFile);
    const claude = mockProvider("claude");
    const openai = mockProvider("openai");
    await runTask(task, claudeDriver({ apiKey: "t", fetchImpl: claude.fetchImpl }), registry, { runsDir, runId: "wire" });
    await runTask(task, openaiDriver({ apiKey: "t", fetchImpl: openai.fetchImpl }), registry, { runsDir, runId: "wire" });
    const lastClaude = JSON.stringify(claude.requests.at(-1));
    const lastOpenai = JSON.stringify(openai.requests.at(-1));
    expect(lastClaude).toContain('"type":"tool_result"');
    expect(lastClaude).toContain('"input_schema"');
    expect(lastOpenai).toContain('"role":"tool"');
    expect(lastOpenai).toContain('"type":"function"');
  });

  it("fails loudly without a provider key", async () => {
    await expect(claudeDriver({ apiKey: "" }).complete("s", [], [])).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });
});
