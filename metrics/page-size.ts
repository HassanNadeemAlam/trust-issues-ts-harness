// Seeds 1000 todos and prints how many items one GET /todos returns.
import { handle } from "../apps/todo-api/src/app.ts";
import { db } from "../apps/todo-api/src/db.ts";

db.todos.reset();
for (let i = 0; i < 1000; i++) db.todos.create({ title: `todo ${i}` });
const body = (await handle({ method: "GET", path: "/todos" })).body as unknown;
const items = Array.isArray(body) ? body : ((body as { items?: unknown[] } | undefined)?.items ?? []);
console.log(items.length);
