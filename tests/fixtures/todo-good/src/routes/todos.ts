import { db } from "../db.ts";
import { json, noContent, problem, validationProblem, type ApiResponse } from "../problem.ts";
import { CreateTodo, TodoId, UpdateTodo } from "../schemas.ts";

export function listTodos(): ApiResponse {
  return json(200, db.todos.findMany());
}

export function createTodo(body: unknown): ApiResponse {
  const parsed = CreateTodo.safeParse(body);
  if (!parsed.success) return validationProblem(parsed.error);
  return json(201, db.todos.create(parsed.data));
}

export function todoById(method: string, rawId: string, body: unknown): ApiResponse {
  const id = TodoId.safeParse(rawId);
  if (!id.success) return validationProblem(id.error);
  if (method === "GET") {
    const row = db.todos.findById(id.data);
    return row ? json(200, row) : problem(404, "Todo not found", `No todo with id ${id.data}`);
  }
  if (method === "PATCH") {
    const parsed = UpdateTodo.safeParse(body);
    if (!parsed.success) return validationProblem(parsed.error);
    const row = db.todos.update(id.data, parsed.data);
    return row ? json(200, row) : problem(404, "Todo not found", `No todo with id ${id.data}`);
  }
  if (method === "DELETE") return db.todos.delete(id.data) ? noContent() : problem(404, "Todo not found", `No todo with id ${id.data}`);
  return problem(405, "Method not allowed", `${method} is not supported on /todos/:id`);
}
