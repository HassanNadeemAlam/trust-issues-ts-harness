import { z } from "zod";

export const TodoId = z.string().uuid();
export const CreateTodo = z.object({ title: z.string().min(1).max(200) }).strict();
export const UpdateTodo = z
  .object({ title: z.string().min(1).max(200).optional(), done: z.boolean().optional() })
  .strict()
  .refine((v) => v.title !== undefined || v.done !== undefined, { message: "Provide title or done" });

export type CreateTodo = z.infer<typeof CreateTodo>;
export type UpdateTodo = z.infer<typeof UpdateTodo>;
