# Todo API (starter workspace)

Build a REST API for a to-do list on top of `src/db.ts`.

Resource `Todo`: `{ id: string (uuid), title: string (1–200 chars), done: boolean, createdAt: ISO string }`.

| Method | Path | Result |
| --- | --- | --- |
| GET | /todos | 200, list |
| POST | /todos | 201, created (`{ title }`) |
| GET | /todos/:id | 200 or 404 |
| PATCH | /todos/:id | 200 (`{ title?, done? }`, at least one) or 404 |
| DELETE | /todos/:id | 204 or 404 |

Access data only through `db.todos` methods.
