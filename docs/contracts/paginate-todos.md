# paginate-todos

Problem: "GET /todos sends back every todo at once; with a long list the response is huge." Evidence: metrics/page-size.ts — with 1000 todos seeded, one GET /todos returns 1000 items on 2026-11-10.
Owner: Hassan Nadeem (todo-api)
Stakeholder: Hassan Nadeem
Metric: items returned by one GET /todos with 1000 todos seeded, per run   before: 1000   after: 50
Metric command: node_modules/.bin/tsx metrics/page-size.ts
Scenario: WHEN GET /todos has no paging params THEN it returns `{ items, nextCursor }` with at most 50 items
Scenario: WHEN GET /todos?limit=10&cursor=<nextCursor> THEN it returns the next 10 items with no overlap
Scenario: WHEN limit is above 100 or not a number THEN the API returns a 400 problem+json
Not included: sorting, filtering, total counts, offset paging
Touches: apps/todo-api/src/**, apps/todo-api/tests/**
Test: npx vitest run apps/todo-api
Signed: Hassan Nadeem, 2026-11-10 — "Yes approved" (transcript 65dfa785-c12b-4f5e-9966-f469e730b1b7)
