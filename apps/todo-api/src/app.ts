import { problem, type ApiRequest, type ApiResponse } from "./problem.ts";
import { createTodo, listTodos, todoById } from "./routes/todos.ts";

export async function handle(req: ApiRequest): Promise<ApiResponse> {
  try {
    const path = req.path.replace(/\/+$/, "") || "/";
    if (path === "/todos") {
      if (req.method === "GET") return listTodos();
      if (req.method === "POST") return createTodo(req.body);
      return problem(405, "Method not allowed", `${req.method} is not supported on /todos`);
    }
    const match = /^\/todos\/([^/]+)$/.exec(path);
    if (match?.[1]) return todoById(req.method, match[1], req.body);
    return problem(404, "Not found", `No route for ${req.path}`);
  } catch {
    return problem(500, "Internal server error");
  }
}
