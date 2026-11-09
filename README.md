# sf-harness-hsn

A model-agnostic harness that drives an LLM (Claude or OpenAI) to build TypeScript REST APIs and holds the result to Zod validation, RFC 7807 problem details and strict type safety. The example workload is a **to-do list API** (`templates/todo-api`).

**Core directory: [`core/`](core/).** Everything else (plugins, tasks, templates, standards) extends it without editing it.

## Setup (one command)

```sh
npm run setup        # install, type-check, run the test suite (no API keys needed)
```

Live runs need keys from the environment (`cp .env.example .env`, then export them). Keys are never read from the repo.

```sh
npm run harness -- run --driver claude,openai     # same task file, both drivers
npm run harness -- check tests/fixtures/todo-good # standards checks on any workspace
npm run harness -- plugins                        # what is registered
```

Each run writes `runs/<task>-<ts>/<driver>/{workspace/,transcript.jsonl,report.json}`.

## Layout

| Path | Role |
| --- | --- |
| `core/engine.ts` | Agent loop: driver ↔ tools, transcript, token report |
| `core/drivers/` | `claude.ts` (Messages API), `openai.ts` (Chat Completions); both translate one neutral message format |
| `core/context/` | `jit.ts` just-in-time tools; `history.ts` window compaction |
| `core/standards/` | `zod.ts`, `rfc7807.ts` (runtime probes), `types.ts` (strict `tsc` + escape-hatch ban) |
| `core/registry.ts` | Tools, checks, ORM validators, lint rules; `use(plugin)` |
| `harness.config.ts` | Plugin list: the only file you touch to extend |
| `plugins/example/` | A tool (`list_routes`), an ORM validator (`db-access`), a lint rule (`no-console`) |
| `tasks/*.task.json` | Provider-neutral tasks; the schema rejects provider keys |
| `standards/*.md` | Rules the model fetches on demand via `get_standard` |

## The four dimensions

| Dimension | How it is met | Evidence |
| --- | --- | --- |
| Model agnosticism | One neutral `Message`/`ToolSpec` type; drivers translate. Task schema is `.strict()`, so a `model` key fails to load. | `tests/drivers.test.ts`: the same task file on both drivers → byte-identical workspaces, both PASS, task file unchanged |
| Token efficiency | Nothing is preloaded: code and standards come through bounded tools (`read_file` ≤80 lines, `search` ≤20 hits, compact `run_checks`). Tool results and written file bodies older than one turn become stubs. | `tests/tokens.test.ts`. Measured context-footprint reduction against an eager harness that inlines the repo and standards each turn: **81.8 %** on the ~60-line starter, **93 %** on an 11-module workspace. Below roughly 10 modules it is under 90 %, because the system prompt and the task are a fixed cost. |
| API standards | Zod check, RFC 7807 runtime probes (status, `application/problem+json`, `type`/`title`/`status`), strict `tsc` with `noUncheckedIndexedAccess` plus an `any`/`@ts-ignore` ban | `tests/standards.test.ts`: the reference passes 4/4 with zero findings; the bad fixture fails all 4 |
| Extensibility | `Plugin { tools, checks, ormValidators, lintRules }` registered from `harness.config.ts` | `tests/extensibility.test.ts`: a new tool, an ORM validator and a lint rule, plus a SHA-256 of `core/` showing it is unchanged |

## Limits, stated plainly

- Token counts use a 4-chars/token estimate for the footprint metric. Provider-reported `input` tokens are recorded alongside it when present.
- The tests use recorded trajectories over mocked HTTP. A live run on both providers has not been recorded yet: **UNPROVEN** until `npm run harness -- run --driver claude,openai` is run with keys.
