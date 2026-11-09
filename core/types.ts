import type { z } from "zod";

/** Provider-neutral conversation primitives. Drivers translate these to and from their wire formats. */
export type Role = "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface Message {
  role: Role;
  text?: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface DriverTurn {
  message: Message;
  usage: Usage;
}

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema for the tool's arguments, derived from the Zod schema by the registry. */
  parameters: Record<string, unknown>;
}

export interface Driver {
  readonly name: string;
  complete(system: string, messages: Message[], tools: ToolSpec[]): Promise<DriverTurn>;
}

export interface ToolContext {
  workspace: string;
  registry: RegistryView;
}

export interface Tool<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  schema: S;
  /** Returns a compact string. Tools must summarise, never dump. */
  run(args: z.infer<S>, ctx: ToolContext): Promise<string> | string;
}

export interface Finding {
  rule: string;
  file?: string;
  line?: number;
  message: string;
}

export interface SourceFile {
  path: string;
  text: string;
}

/** A standards check over a generated API workspace. */
export interface Check {
  name: string;
  run(workspace: string, files: SourceFile[]): Promise<Finding[]> | Finding[];
}

/** Validates data-layer code (ORM/query usage). */
export interface OrmValidator {
  name: string;
  validate(file: SourceFile): Finding[];
}

/** A single-file lint rule. */
export interface LintRule {
  name: string;
  check(file: SourceFile): Finding[];
}

export interface Plugin {
  name: string;
  tools?: Tool[];
  checks?: Check[];
  ormValidators?: OrmValidator[];
  lintRules?: LintRule[];
}

export interface RegistryView {
  tools(): Tool[];
  checks(): Check[];
  ormValidators(): OrmValidator[];
  lintRules(): LintRule[];
}

export interface Probe {
  method: string;
  path: string;
  body?: unknown;
  expectStatus: number;
}

/** A task file. It must not mention any provider: the same file runs on every driver. */
export interface Task {
  id: string;
  template: string;
  goal: string;
  acceptance: string[];
  probes: Probe[];
  maxTurns?: number;
}
