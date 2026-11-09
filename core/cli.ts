import { join, resolve } from "node:path";
import { loadRegistry } from "./config.ts";
import { getDriver } from "./drivers/index.ts";
import { runTask } from "./engine.ts";
import { allPassed, runStandards, summarize } from "./standards/index.ts";
import { loadTask } from "./task.ts";

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name: string, fallback?: string) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : fallback;
};

async function main(): Promise<number> {
  const registry = await loadRegistry();
  const taskPath = resolve(flag("task", "tasks/todo-api.task.json")!);

  if (cmd === "run") {
    const task = loadTask(taskPath);
    const drivers = (flag("driver", "claude") ?? "claude").split(",");
    const runId = `${task.id}-${Date.now()}`;
    let ok = true;
    for (const name of drivers) {
      const r = await runTask(task, getDriver(name), registry, { runId });
      console.log(`\n[${name}] finished=${r.finished} passed=${r.passed}\n${summarize(r.checks)}`);
      console.log(`[${name}] tokens: ${JSON.stringify(r.tokens)}`);
      ok &&= r.passed;
    }
    console.log(`\nreports: ${join("runs", runId)}`);
    return ok ? 0 : 1;
  }

  if (cmd === "check") {
    const task = loadTask(taskPath);
    const ws = resolve(rest.find((a) => !a.startsWith("--") && a !== flag("task")) ?? ".");
    const results = await runStandards(ws, task.probes, registry);
    console.log(summarize(results, 50));
    return allPassed(results) ? 0 : 1;
  }

  if (cmd === "plugins") {
    console.log(`plugins: ${registry.plugins.join(", ")}`);
    console.log(`tools: ${registry.tools().map((t) => t.name).join(", ")}`);
    console.log(`orm validators: ${registry.ormValidators().map((t) => t.name).join(", ")}`);
    console.log(`lint rules: ${registry.lintRules().map((t) => t.name).join(", ")}`);
    return 0;
  }

  console.log("usage: harness run --driver claude,openai [--task file] | check <workspace> [--task file] | plugins");
  return cmd ? 1 : 0;
}

main().then((code) => process.exit(code), (e: Error) => {
  console.error(e.message);
  process.exit(1);
});
