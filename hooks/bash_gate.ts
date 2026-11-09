// PreToolUse(Bash): no pushes, PR actions, data mutation or ledger tampering by the agent; shell writes obey the item gates.
import { shellGate } from "../workflow/gates.ts";
import { exitPreToolUse, readInput } from "./io.ts";

const input = await readInput();
exitPreToolUse(shellGate(String(input.tool_input?.command ?? ""), input.transcript_path));
