// PreToolUse(Edit|Write|MultiEdit|NotebookEdit): problem statement, human yes, red-before-green, Touches, harness-owned files.
import { editGate } from "../workflow/gates.ts";
import { exitPreToolUse, readInput } from "./io.ts";

const input = await readInput();
exitPreToolUse(editGate(input.tool_name ?? "", input.tool_input ?? {}, input.transcript_path));
