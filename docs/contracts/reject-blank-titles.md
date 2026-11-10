# reject-blank-titles

Problem: "I can create a todo whose title is just spaces and it shows up as an empty row." Evidence: metrics/blank-titles.ts — 5 of 5 whitespace-only titles (spaces, tab, newlines, mixed, non-breaking spaces) return 201 on 2026-11-10; `z.string().min(1)` counts whitespace as content.
Owner: Hassan Nadeem (todo-api)
Stakeholder: Hassan Nadeem
Metric: whitespace-only titles accepted out of 5 probes, per run   before: 5   after: 0
Metric command: node_modules/.bin/tsx metrics/blank-titles.ts
Scenario: WHEN POST /todos has a title made only of whitespace THEN the API returns a 400 problem+json naming `title`
Scenario: WHEN PATCH /todos/:id sets a whitespace-only title THEN the API returns a 400 problem+json naming `title`
Scenario: WHEN a title has leading or trailing spaces THEN it is stored trimmed
Not included: changing the 200-character limit, migrating already-stored blank titles, UI changes
Touches: apps/todo-api/src/**, apps/todo-api/tests/**
Test: npx vitest run apps/todo-api
Signed: Hassan Nadeem, 2026-11-09 — "Yes approved" (transcript 82265db4-228c-4199-93d6-92ec7df238fc)
