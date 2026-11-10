# add-priority

Problem: "All my todos look the same; I can't tell which ones matter." Evidence: metrics/priority.ts — 1 of 3 priority scenarios pass on 2026-11-10; the one that passes is only the strict schema rejecting the unknown key.
Owner: Hassan Nadeem (todo-api)
Stakeholder: Hassan Nadeem
Metric: priority scenarios passing out of 3, per run   before: 1   after: 3
Metric command: node_modules/.bin/tsx metrics/priority.ts
Scenario: WHEN POST /todos includes priority "high" THEN the 201 body has priority "high"
Scenario: WHEN GET /todos/:id for that todo THEN the body has priority "high"
Scenario: WHEN priority is not one of low, medium, high THEN the API returns a 400 problem+json
Scenario: WHEN priority is omitted THEN it defaults to "medium"
Not included: sorting or filtering by priority, UI
Touches: apps/todo-api/src/**, apps/todo-api/tests/**
Test: npx vitest run apps/todo-api
Signed: Hassan Nadeem, 2026-11-10 — "yes" (transcript 79dcf555-b9a8-4b44-b9de-56b17a40a904)
