// Prints how many of 3 priority scenarios pass.
import { handle } from "../apps/todo-api/src/app.ts";
import { db } from "../apps/todo-api/src/db.ts";

db.todos.reset();
let pass = 0;
const created = await handle({ method: "POST", path: "/todos", body: { title: "pay rent", priority: "high" } });
const row = created.body as { id?: string; priority?: string };
if (created.status === 201 && row.priority === "high") pass++;
if (row.id && ((await handle({ method: "GET", path: `/todos/${row.id}` })).body as { priority?: string }).priority === "high") pass++;
const bad = await handle({ method: "POST", path: "/todos", body: { title: "x", priority: "urgent" } });
if (bad.status === 400 && bad.headers["content-type"] === "application/problem+json") pass++;
console.log(pass);
