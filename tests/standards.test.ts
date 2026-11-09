import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadRegistry } from "../core/config.ts";
import { allPassed, runStandards } from "../core/standards/index.ts";
import { loadTask } from "../core/task.ts";

const task = loadTask(join(import.meta.dirname, "../tasks/todo-api.task.json"));

describe("API standards", () => {
  it("reference Todo API passes Zod, RFC 7807, strict types and plugin rules (100%)", async () => {
    const results = await runStandards(join(import.meta.dirname, "fixtures/todo-good"), task.probes, await loadRegistry());
    expect(results.map((r) => [r.name, r.findings])).toEqual([
      ["zod", []],
      ["rfc7807", []],
      ["types", []],
      ["plugins", []],
    ]);
  });

  it("non-compliant API fails every standard", async () => {
    const results = await runStandards(join(import.meta.dirname, "fixtures/todo-bad"), task.probes, await loadRegistry());
    expect(allPassed(results)).toBe(false);
    for (const r of results) expect(r.findings.length, r.name).toBeGreaterThan(0);
  });

  it("task files reject provider-specific keys", () => {
    expect(() => loadTask(join(import.meta.dirname, "fixtures/provider-task.json"))).toThrow(/model/);
  });
});
