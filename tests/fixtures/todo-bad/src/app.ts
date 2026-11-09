import { createTodo } from "./routes/todos.ts";

export async function handle(req: { method: string; path: string; body?: unknown }) {
  if (req.path === "/todos" && req.method === "POST") return createTodo(req.body);
  return { status: 404, headers: { "content-type": "application/json" }, body: { error: "not found" } };
}
