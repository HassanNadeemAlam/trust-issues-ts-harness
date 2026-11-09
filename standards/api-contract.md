# API contract

- `src/app.ts` exports `handle(req: { method: string; path: string; body?: unknown }): Promise<{ status: number; headers: Record<string, string>; body: unknown }>`.
- `src/server.ts` (optional) wraps `handle` in `node:http`; the harness calls `handle` directly.
- One module per resource under `src/routes/`. Shared Zod schemas live in `src/schemas.ts`.
- Success responses use `content-type: application/json`. Errors follow `rfc7807`.
- No runtime dependencies other than `zod`.
