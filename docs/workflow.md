# Workflow — Hassan Nadeem

## How work reaches me

- **Jira (SFW project)** is the main channel. Tickets often carry one line and no detail (SEM tickets especially), so before I can start I have to rebuild the problem from the code and the data.
- **Teams** for review pings and release questions. After shipping I post a fixed-format message: ticket link plus one PR link per repo.
- **Stand-up** asks; I write the "scrum update" from commits and ticket status, not memory.
- **Order I act on:** release-blocking bugs on beta/dev first, then the ticket in progress, then new Jira.

## Where I lose time

1. **Waiting for a yes.** A Jira comment, a scope call or a "can I run this backfill" sits until a PM/lead answers. Work drifts while I wait, and I have started building before the answer more than once.
2. **Re-reading the repo.** Frontend, Strapi, automation, dashboard, audit harness — five codebases. Every ticket starts with re-deriving where the code is and what the data says.
3. **Re-running checks and re-proving status.** Type-check, tests, lint, format, build; then finding out whether a PR actually landed in the release branch rather than trusting the ticket status.

## What I repeat

- Writing the spec before code (`docs/specs/<key>.md`): problem, scope, not-in-scope, acceptance criteria.
- Running the same validation chain before every push.
- Branch → commit → push → PR → Jira comment → update ticket-status and release index.
- Drafting the Teams message and the scrum update in the same format every time.

## What breaks (mistakes made twice)

1. **Code before the problem is agreed.** I start implementing from the ticket title and the scope moves under me.
2. **Posting to Jira/GitHub before review.** An agent posted a comment I had not approved; my rule is now "draft, I post".
3. **Status on someone's word.** A ticket marked done whose PR was not in the release branch; "deployed" claimed without evidence.
4. **Running data-mutating scripts as "validation".** Backfill/sync scripts touch production-shaped data.
5. **Editing outside my ownership** to unblock myself in a shared repo (someone else's `commands.js`).
6. **Code comments pointing at `docs/`**, a folder app readers cannot see.
7. **Writing to frozen records** (`docs/tickets`, `docs/design`) instead of the spec.
8. **Secrets near commits:** `.env` files live next to the code in every repo.

## The three backlog items

Example project: the to-do list API in `apps/todo-api`. Stakeholder for all three: Hassan Nadeem (me).

- `reject-blank-titles`: owner Hassan Nadeem. Metric: whitespace-only titles accepted out of 5 probes, per run. **5 → 0** (PR #1, records #3)
- `paginate-todos`: owner Hassan Nadeem. Metric: items returned by one GET /todos with 1000 seeded, per run. **1000 → 50** (PR #5, records #6)
- `add-priority`: owner Hassan Nadeem. Metric: priority scenarios passing out of 3, per run. **1 → 3** (PR #7, records #8)

## Gate by gate

| Habit or failure | Mechanism | File |
| --- | --- | --- |
| Problem statement before edit (breaks #1) | hook, PreToolUse Edit/Write | `hooks/problem_gate.ts` → `workflow/gates.ts#editGate` |
| Same gate via the shell (`echo >`, `sed -i`, `cp`) | hook, PreToolUse Bash | `hooks/bash_gate.ts` → `shellGate` |
| Stakeholder yes in a typed turn (lose-time #1, breaks #1) | hook, Stop | `hooks/contract_gate.ts` → `stopGate`, `workflow/transcript.ts` |
| Yes covers the contract as written; edits void it | check, contract hash | `workflow/contract.ts#contractHash`, `workflow/cli.ts#approvedContract` |
| Agent cannot type Signed / before / after | hook | `editGate` (harness-owned lines) |
| Red before green | hook + command | `itemGate("source")`, `npm run item -- red` |
| Proof before ship, UNPROVEN never passes (breaks #3) | command | `npm run item -- proof` |
| Agent never pushes / opens or merges PRs | hook + command | `policy.forbiddenShell`, `npm run item -- ship` |
| Metric read after merge before close (breaks #3) | check | `checks/check_outcome.ts` |
| Evidence cannot be edited by hand | check, hash-chained ledger | `workflow/ledger.ts#verifyChain` |
| Draft, never post, to Jira/GitHub/Teams (breaks #2) | hook, PreToolUse mcp__* | `hooks/external_post_gate.ts` |
| No data-mutating scripts or DB writes (breaks #4) | hook | `policy.forbiddenShell` |
| Stay inside what the item owns (breaks #5) | hook, contract `Touches` | `editGate` |
| No `docs/` references in code comments (breaks #6) | lint rule via the 01 plugin API | `plugins/hassan/index.ts` |
| Frozen history is read-only (breaks #7) | hook | `policy.frozen` |
| No secrets / `.env` in a ship (breaks #8) | command | `proof` steps `secrets`, `no .env` |
| Re-reading the repo (lose-time #2) | context | 01 JIT tools + `list_routes` |
| Status index and Teams message (repeat) | command | `ship` appends `docs/ticket-status.md`; `npm run item -- teams` |
