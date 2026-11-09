// Prints how many whitespace-only titles the API accepts (201) out of 5 probes.
import { handle } from "../apps/todo-api/src/app.ts";
import { db } from "../apps/todo-api/src/db.ts";

db.todos.reset();
const titles = ["   ", "\t", "\n\n", " \t ", "  "];
let accepted = 0;
for (const title of titles) if ((await handle({ method: "POST", path: "/todos", body: { title } })).status === 201) accepted++;
console.log(accepted);
