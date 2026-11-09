import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import type { Task } from "./types.ts";

const TaskSchema = z
  .object({
    id: z.string().min(1),
    template: z.string().min(1),
    goal: z.string().min(1),
    acceptance: z.array(z.string()),
    probes: z.array(z.object({ method: z.string(), path: z.string(), body: z.unknown().optional(), expectStatus: z.number().int() })),
    maxTurns: z.number().int().positive().optional(),
  })
  .strict();

/** Loads a task file. Task files are provider-neutral by schema: unknown keys (e.g. a model name) are rejected. */
export function loadTask(path: string): Task {
  const task = TaskSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  return { ...task, template: resolve(dirname(path), "..", task.template) };
}
