import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadRegistry } from "../core/config.ts";
import { jitTools } from "../core/context/jit.ts";
import { claudeDriver } from "../core/drivers/index.ts";
import { runTask } from "../core/engine.ts";
import { loadTask } from "../core/task.ts";
import { mockProvider } from "./helpers/scripted.ts";

const runsDir = join(import.meta.dirname, "../runs/test-tokens");
afterAll(() => rmSync(runsDir, { recursive: true, force: true }));

describe("token efficiency", () => {
  it("reports the context footprint against an eager baseline", async () => {
    const task = loadTask(join(import.meta.dirname, "../tasks/todo-api.task.json"));
    const r = await runTask(task, claudeDriver({ apiKey: "t", fetchImpl: mockProvider("claude").fetchImpl }), await loadRegistry(), { runsDir, runId: "tok" });
    console.log("token report", r.tokens);
    expect(r.tokens.eagerContextFootprint).toBeGreaterThan(r.tokens.contextFootprint);
    expect(r.tokens.reductionPct).toBeGreaterThan(80);
  });

  it("exceeds 90% on a workspace of realistic size, because the JIT footprint does not grow with the repo", async () => {
    const task = loadTask(join(import.meta.dirname, "../tasks/todo-api.task.json"));
    const big = join(runsDir, "big-template");
    cpSync(task.template, big, { recursive: true });
    // Ten sibling resource modules of the reference solution's size: a small real service, not padding text.
    const routes = readFileSync(join(import.meta.dirname, "fixtures/todo-good/src/routes/todos.ts"), "utf8");
    mkdirSync(join(big, "src/legacy"), { recursive: true });
    for (const name of ["projects", "labels", "comments", "users", "teams", "tags", "reminders", "lists", "shares", "audits"])
      writeFileSync(join(big, `src/legacy/${name}.ts`), routes.replaceAll("Todo", name[0]!.toUpperCase() + name.slice(1)));
    const r = await runTask({ ...task, template: big }, claudeDriver({ apiKey: "t", fetchImpl: mockProvider("claude").fetchImpl }), await loadRegistry(), { runsDir, runId: "tok-big" });
    console.log("token report (11-module workspace)", r.tokens);
    expect(r.tokens.reductionPct).toBeGreaterThan(90);
  });

  it("bounds read_file output", async () => {
    const read = jitTools.find((t) => t.name === "read_file")!;
    const ws = join(import.meta.dirname, "..");
    const out = await read.run({ path: "core/engine.ts" }, { workspace: ws, registry: await loadRegistry() });
    expect(out.split("\n").length).toBeLessThanOrEqual(81);
  });
});
