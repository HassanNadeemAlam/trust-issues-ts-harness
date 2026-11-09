# sf-harness-hsn

A model-agnostic harness that drives an LLM (Claude or OpenAI) to build TypeScript REST APIs and holds the result to Zod validation, RFC 7807 problem details and strict type safety. The example workload is a **to-do list API** (`templates/todo-api`).

**Core directory: [`core/`](core/).** Everything else (plugins, tasks, templates, standards) extends it without editing it.

Assignment 02 sits on top as [`workflow/`](workflow/), [`hooks/`](hooks/) and [`checks/`](checks/) (tags `a01` → `a02`). See [docs/workflow.md](docs/workflow.md) for each gate and the habit behind it.

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

## Assignment 02: item lifecycle

Open Claude Code in this folder; `.claude/settings.json` wires the hooks.

```sh
npm run item -- start <slug>             # creates docs/contracts/<slug>.md, makes it active
npm run item -- metric <slug> --before   # harness runs `Metric command`, writes before
npm run item -- propose <slug>           # prints the contract + AWAITING-YES; stakeholder types a yes
npm run item -- red <slug>               # contract `Test` must FAIL; source edits unlock
npm run item -- proof <slug>             # type-check, item tests, suite, standards, secrets, .env
npm run item -- ship <slug>              # branch item/<slug>, commit, push, gh pr create (human merges)
npm run item -- metric <slug> --after    # checks the PR is MERGED, reads the metric
npm run item -- close <slug>             # checks/check_outcome.ts; refuses with reasons
npm run item -- status | teams <slug>
```

Gates and their skip tests: `tests/gates.test.ts` runs the real hook scripts as subprocesses.

| Grader's skip attempt | Result |
| --- | --- |
| Edit a source file with no contract | exit 2: `No active item` / `missing: <fields>` |
| Echo "yes" from a tool result, then Stop | Stop blocked: `tool output or your own text does not count` |
| Close without reading the metric | `REFUSED … was not read after the merge` |

## Live evidence

- `docs/evidence/a01-live-claude-code-*`: a real run of `tasks/todo-api.task.json` through the `claude-code` driver (the user's Claude Code login, no API key). 4 turns, all checks PASS, 81.9 % footprint reduction. Claude Code bills its own system prompt on every call, so `input` is ~320k tokens, mostly cache reads. The footprint metric measures only what the harness puts in the window.

## Limits, stated plainly

- Token counts use a 4-chars/token estimate for the footprint metric. Provider-reported `input` tokens are recorded alongside it when present.
- The Claude and OpenAI HTTP drivers are tested over mocked HTTP only. No keys are available, so a live run on them is **UNPROVEN**. The live run uses the `claude-code` driver.
- The human-yes gate proves the yes was *typed at the terminal* after the proposal. It cannot prove *who* typed it. The stakeholder has to type it themselves.
- The shell-write gate is a pattern match. An obfuscated write could slip past it, but nothing it writes could forge the ledger, and ship/close re-check everything.
