import { rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadRegistry } from "../core/config.ts";
import { claudeCodeDriver } from "../core/drivers/index.ts";
import type { CliRunner } from "../core/drivers/claude-code.ts";
import { runTask } from "../core/engine.ts";
import { loadTask } from "../core/task.ts";
import { scriptedTurns } from "./helpers/scripted.ts";

const runsDir = join(import.meta.dirname, "../runs/test-cc");
afterAll(() => rmSync(runsDir, { recursive: true, force: true }));

describe("claude-code driver", () => {
  it("runs the same task file through the CLI wire format", async () => {
    const turns = scriptedTurns();
    const calls: string[][] = [];
    const runner: CliRunner = async (args, stdin) => {
      calls.push(args);
      const turn = (stdin.match(/^\[you\]$/gm) ?? []).length;
      return JSON.stringify({ is_error: false, structured_output: { tool_calls: turns[turn] ?? [] }, usage: { input_tokens: 5, output_tokens: 5 } });
    };
    const r = await runTask(loadTask(join(import.meta.dirname, "../tasks/todo-api.task.json")), claudeCodeDriver({ runner }), await loadRegistry(), { runsDir, runId: "cc" });
    expect(r.passed).toBe(true);
    expect(r.finished).toBe(true);
    expect(calls[0]).toEqual(expect.arrayContaining(["--tools", "", "--json-schema"]));
  });
});
