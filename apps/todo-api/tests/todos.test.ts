import { beforeEach, describe, expect, it } from "vitest";
import { handle } from "../src/app.ts";
import { db } from "../src/db.ts";

beforeEach(() => db.todos.reset());

describe("todo api", () => {
  it("creates and lists todos", async () => {
    const created = await handle({ method: "POST", path: "/todos", body: { title: "buy milk" } });
    expect(created.status).toBe(201);
    const list = await handle({ method: "GET", path: "/todos" });
    expect(list.body).toHaveLength(1);
  });

  it("rejects an empty title with a problem document", async () => {
    const res = await handle({ method: "POST", path: "/todos", body: { title: "" } });
    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toBe("application/problem+json");
  });

  it("toggles done", async () => {
    const created = (await handle({ method: "POST", path: "/todos", body: { title: "t" } })).body as { id: string };
    const res = await handle({ method: "PATCH", path: `/todos/${created.id}`, body: { done: true } });
    expect((res.body as { done: boolean }).done).toBe(true);
  });
});
