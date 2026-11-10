import { randomUUID } from "node:crypto";

export interface TodoRow {
  id: string;
  title: string;
  done: boolean;
  priority: Priority;
  createdAt: string;
}

export type Priority = "low" | "medium" | "high";

const rows = new Map<string, TodoRow>();

/** Tiny in-memory data layer standing in for an ORM. All access goes through these methods. */
export const db = {
  todos: {
    findMany(): TodoRow[] {
      return [...rows.values()];
    },
    findById(id: string): TodoRow | undefined {
      return rows.get(id);
    },
    create(data: { title: string; priority?: Priority }): TodoRow {
      const row: TodoRow = {
        id: randomUUID(),
        title: data.title,
        done: false,
        priority: data.priority ?? "medium",
        createdAt: new Date().toISOString(),
      };
      rows.set(row.id, row);
      return row;
    },
    update(id: string, data: Partial<Pick<TodoRow, "title" | "done" | "priority">>): TodoRow | undefined {
      const row = rows.get(id);
      if (!row) return undefined;
      const next = { ...row, ...data };
      rows.set(id, next);
      return next;
    },
    delete(id: string): boolean {
      return rows.delete(id);
    },
    reset(): void {
      rows.clear();
    },
  },
};
