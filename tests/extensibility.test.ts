import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { loadRegistry } from "../core/config.ts";
import { runStandards } from "../core/standards/index.ts";
import { loadTask } from "../core/task.ts";
import { listFiles } from "../core/workspace.ts";
import type { Plugin } from "../core/types.ts";

const root = join(import.meta.dirname, "..");
const task = loadTask(join(root, "tasks/todo-api.task.json"));
const good = join(import.meta.dirname, "fixtures/todo-good");
const coreHash = () =>
  createHash("sha256")
    .update(listFiles(join(root, "core")).map((p) => readFileSync(join(root, "core", p), "utf8")).join("\0"))
    .digest("hex");

describe("extensibility without core edits", () => {
  const hashBefore = coreHash();

  it("registers a new tool", async () => {
    const plugin: Plugin = { name: "t", tools: [{ name: "count_files", description: "count", schema: z.object({}), run: (_a, c) => String(listFiles(c.workspace).length) }] };
    const registry = await loadRegistry(undefined, [plugin]);
    expect(registry.toolSpecs().map((t) => t.name)).toContain("count_files");
    expect(await registry.tool("count_files")!.run({}, { workspace: good, registry })).toMatch(/^\d+$/);
  });

  it("registers a custom ORM validator that blocks findMany without a limit", async () => {
    const plugin: Plugin = {
      name: "orm",
      ormValidators: [{ name: "paginate", validate: (f) => (/findMany\(\)/.test(f.text) ? [{ rule: "paginate", file: f.path, message: "findMany() without limit" }] : []) }],
    };
    const results = await runStandards(good, task.probes, await loadRegistry(undefined, [plugin]));
    expect(results.find((r) => r.name === "plugins")!.findings.map((f) => f.rule)).toContain("paginate");
  });

  it("registers a custom linter rule", async () => {
    const plugin: Plugin = {
      name: "lint",
      lintRules: [{ name: "no-todo-comment", check: (f) => (f.text.includes("TODO:") ? [{ rule: "no-todo-comment", file: f.path, message: "TODO left" }] : []) }],
    };
    const registry = await loadRegistry(undefined, [plugin]);
    expect(registry.lintRules().map((r) => r.name)).toEqual(["no-console", "no-todo-comment"]);
    expect(registry.lintRules()[1]!.check({ path: "src/a.ts", text: "// TODO: x" })).toHaveLength(1);
  });

  it("rejects duplicate registrations", async () => {
    const registry = await loadRegistry();
    expect(() => registry.use({ name: "dup", lintRules: [{ name: "no-console", check: () => [] }] })).toThrow(/Duplicate/);
  });

  it("left every core file unchanged", () => {
    expect(coreHash()).toBe(hashBefore);
  });
});
