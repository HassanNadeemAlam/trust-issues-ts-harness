import type { Driver } from "../types.ts";
import { claudeCodeDriver } from "./claude-code.ts";
import { claudeDriver } from "./claude.ts";
import { openaiDriver } from "./openai.ts";

const factories: Record<string, () => Driver> = { claude: () => claudeDriver(), openai: () => openaiDriver(), "claude-code": () => claudeCodeDriver() };

/** Registers an additional driver by name (e.g. from a plugin) without touching this file's callers. */
export function registerDriver(name: string, factory: () => Driver): void {
  factories[name] = factory;
}

export function getDriver(name: string): Driver {
  const f = factories[name];
  if (!f) throw new Error(`Unknown driver "${name}". Known: ${Object.keys(factories).join(", ")}`);
  return f();
}

export { claudeCodeDriver, claudeDriver, openaiDriver };
