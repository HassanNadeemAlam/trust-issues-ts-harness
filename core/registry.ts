import { zodToJsonSchema } from "./schema.ts";
import type { Check, LintRule, OrmValidator, Plugin, RegistryView, Tool, ToolSpec } from "./types.ts";

/** Holds every tool, check, ORM validator and lint rule. Plugins extend it; the core never needs editing. */
export class Registry implements RegistryView {
  private readonly _tools = new Map<string, Tool>();
  private readonly _checks = new Map<string, Check>();
  private readonly _orm = new Map<string, OrmValidator>();
  private readonly _lint = new Map<string, LintRule>();
  readonly plugins: string[] = [];

  registerTool(tool: Tool): this {
    return this.put(this._tools, tool, "tool");
  }
  registerCheck(check: Check): this {
    return this.put(this._checks, check, "check");
  }
  registerOrmValidator(v: OrmValidator): this {
    return this.put(this._orm, v, "ORM validator");
  }
  registerLintRule(rule: LintRule): this {
    return this.put(this._lint, rule, "lint rule");
  }

  use(plugin: Plugin): this {
    plugin.tools?.forEach((t) => this.registerTool(t));
    plugin.checks?.forEach((c) => this.registerCheck(c));
    plugin.ormValidators?.forEach((v) => this.registerOrmValidator(v));
    plugin.lintRules?.forEach((r) => this.registerLintRule(r));
    this.plugins.push(plugin.name);
    return this;
  }

  tools(): Tool[] {
    return [...this._tools.values()];
  }
  checks(): Check[] {
    return [...this._checks.values()];
  }
  ormValidators(): OrmValidator[] {
    return [...this._orm.values()];
  }
  lintRules(): LintRule[] {
    return [...this._lint.values()];
  }

  toolSpecs(): ToolSpec[] {
    return this.tools().map((t) => ({ name: t.name, description: t.description, parameters: zodToJsonSchema(t.schema) }));
  }

  tool(name: string): Tool | undefined {
    return this._tools.get(name);
  }

  private put<T extends { name: string }>(map: Map<string, T>, item: T, kind: string): this {
    if (map.has(item.name)) throw new Error(`Duplicate ${kind}: ${item.name}`);
    map.set(item.name, item);
    return this;
  }
}
