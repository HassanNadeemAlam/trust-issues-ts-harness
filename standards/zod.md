# Zod validation

- Every value that crosses the boundary (body, path params, query) is parsed with a Zod schema before use.
- Use `safeParse` and turn failures into a 400 problem (`rfc7807`) listing the failing fields in `errors`.
- Derive TypeScript types with `z.infer<typeof Schema>`; never hand-write a duplicate interface.
- Schemas are `.strict()` so unknown keys are rejected.
