import { db } from "../db.ts";

export function createTodo(body: any) {
  console.log("creating", body);
  if (!body.title) return { status: 400, headers: { "content-type": "application/json" }, body: { error: "title required" } };
  return { status: 201, headers: { "content-type": "application/json" }, body: db.todos.create(body) };
}
