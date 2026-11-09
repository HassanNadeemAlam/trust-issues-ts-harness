// PreToolUse(mcp__.*): Jira/GitHub/Teams writes are drafted for Hassan, never posted by the agent.
import { externalPostGate } from "../workflow/gates.ts";
import { exitPreToolUse, readInput } from "./io.ts";

const input = await readInput();
exitPreToolUse(externalPostGate(input.tool_name ?? ""));
