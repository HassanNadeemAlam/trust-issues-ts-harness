import { beforeEach, describe, expect, it } from "vitest";
import { handle } from "../src/app.ts";
import { db } from "../src/db.ts";

beforeEach(() => db.todos.reset());

describe("todo api", () => {
  it("creates and lists todos", async () => {
    const created = await handle({ method: "POST", path: "/todos", body: { title: "buy milk" } });
    expect(created.status).toBe(201);
    const list = await handle({ method: "GET", path: "/todos" });
    expect((list.body as { items: unknown[] }).items).toHaveLength(1);
  });

  describe("pagination", () => {
    type Page = { items: Array<{ id: string }>; nextCursor: string | null };
    const seed = (n: number) => {
      for (let i = 0; i < n; i++) db.todos.create({ title: `todo ${i}` });
    };

    it("returns at most 50 items with a cursor by default", async () => {
      seed(120);
      const res = await handle({ method: "GET", path: "/todos" });
      expect(res.status).toBe(200);
      const page = res.body as Page;
      expect(page.items).toHaveLength(50);
      expect(typeof page.nextCursor).toBe("string");
    });

    it("returns null nextCursor on the last page", async () => {
      seed(3);
      const page = (await handle({ method: "GET", path: "/todos" })).body as Page;
      expect(page.items).toHaveLength(3);
      expect(page.nextCursor).toBeNull();
    });

    it("walks pages with limit and cursor without overlap", async () => {
      seed(25);
      const first = (await handle({ method: "GET", path: "/todos?limit=10" })).body as Page;
      const second = (await handle({ method: "GET", path: `/todos?limit=10&cursor=${first.nextCursor}` })).body as Page;
      expect(first.items).toHaveLength(10);
      expect(second.items).toHaveLength(10);
      const ids = [...first.items, ...second.items].map((t) => t.id);
      expect(new Set(ids).size).toBe(20);
      expect(ids).toEqual(db.todos.findMany().slice(0, 20).map((t) => t.id));
    });

    it.each(["101", "abc", "0", "-1"])("rejects limit=%s with a problem document", async (limit) => {
      const res = await handle({ method: "GET", path: `/todos?limit=${limit}` });
      expect(res.status).toBe(400);
      expect(res.headers["content-type"]).toBe("application/problem+json");
    });
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
