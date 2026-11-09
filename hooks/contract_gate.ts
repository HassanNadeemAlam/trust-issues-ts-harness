// Stop: the human-yes gate. A proposed contract holds the Stop until the stakeholder's typed yes is in the transcript.
import { stopGate } from "../workflow/gates.ts";
import { lastAssistantText, readInput } from "./io.ts";

const input = await readInput();
const v = stopGate(input.transcript_path, lastAssistantText(input.transcript_path));
if (!v.ok) process.stdout.write(JSON.stringify({ decision: "block", reason: `[sf-harness] ${v.reason}` }));
process.exit(0);
