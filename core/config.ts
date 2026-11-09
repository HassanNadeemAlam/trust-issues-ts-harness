import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { jitTools } from "./context/jit.ts";
import { Registry } from "./registry.ts";
import type { Plugin } from "./types.ts";

/** Builds the registry: built-in JIT tools, then every plugin listed in harness.config.ts. */
export async function loadRegistry(configPath = join(process.cwd(), "harness.config.ts"), extra: Plugin[] = []): Promise<Registry> {
  const registry = new Registry();
  jitTools.forEach((t) => registry.registerTool(t));
  if (existsSync(configPath)) {
    const mod = (await import(pathToFileURL(configPath).href)) as { plugins?: Plugin[] };
    mod.plugins?.forEach((p) => registry.use(p));
  }
  extra.forEach((p) => registry.use(p));
  return registry;
}
