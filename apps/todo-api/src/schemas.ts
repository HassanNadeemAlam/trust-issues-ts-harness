import { z } from "zod";

export const TodoId = z.string().uuid();
const Title = z.string().trim().min(1).max(200);

const Priority = z.enum(["low", "medium", "high"]);

export const CreateTodo = z.object({ title: Title, priority: Priority.default("medium") }).strict();
export const UpdateTodo = z
  .object({ title: Title.optional(), done: z.boolean().optional(), priority: Priority.optional() })
  .strict()
  .refine((v) => v.title !== undefined || v.done !== undefined || v.priority !== undefined, {
    message: "Provide title, done or priority",
  });

export const ListTodosQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: TodoId.optional(),
  })
  .strict();

export type CreateTodo =z.infer<typeof CreateTodo>;
export type UpdateTodo = z.infer<typeof UpdateTodo>;
