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

  it.each(["   ", "\t", "\n\n", " \t\n ", "  "])("rejects a whitespace-only title on create (%j)", async (title) => {
    const res = await handle({ method: "POST", path: "/todos", body: { title } });
    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toBe("application/problem+json");
    expect((res.body as { errors: Array<{ path: string }> }).errors.map((e) => e.path)).toContain("title");
  });

  it("rejects a whitespace-only title on update", async () => {
    const created = (await handle({ method: "POST", path: "/todos", body: { title: "t" } })).body as { id: string };
    const res = await handle({ method: "PATCH", path: `/todos/${created.id}`, body: { title: "  \t " } });
    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toBe("application/problem+json");
    expect((res.body as { errors: Array<{ path: string }> }).errors.map((e) => e.path)).toContain("title");
  });

  it("stores titles trimmed", async () => {
    const created = await handle({ method: "POST", path: "/todos", body: { title: "  buy milk  " } });
    expect((created.body as { title: string }).title).toBe("buy milk");
    const id = (created.body as { id: string }).id;
    const updated = await handle({ method: "PATCH", path: `/todos/${id}`, body: { title: " eggs\t" } });
    expect((updated.body as { title: string }).title).toBe("eggs");
  });

  it("toggles done", async () => {
    const created = (await handle({ method: "POST", path: "/todos", body: { title: "t" } })).body as { id: string };
    const res = await handle({ method: "PATCH", path: `/todos/${created.id}`, body: { done: true } });
    expect((res.body as { done: boolean }).done).toBe(true);
  });
});
