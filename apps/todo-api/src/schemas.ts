import { z } from "zod";

export const TodoId = z.string().uuid();
const Title = z.string().trim().min(1).max(200);

export const CreateTodo = z.object({ title: Title }).strict();
export const UpdateTodo = z
  .object({ title: Title.optional(), done: z.boolean().optional() })
  .strict()
  .refine((v) => v.title !== undefined || v.done !== undefined, { message: "Provide title or done" });

export const ListTodosQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: TodoId.optional(),
  })
  .strict();

export type CreateTodo =z.infer<typeof CreateTodo>;
export type UpdateTodo = z.infer<typeof UpdateTodo>;
