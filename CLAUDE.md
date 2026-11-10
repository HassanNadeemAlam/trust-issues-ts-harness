# Working in sf-harness-hsn

Hooks in `.claude/settings.json` enforce everything below. If a hook refuses, read the reason and follow it; never work around it.

Item flow (one active item at a time):
0. `npm run item -- sync` to update main (git pull is blocked).
1. `npm run item -- start <slug>`, fill `docs/contracts/<slug>.md` (Problem, Owner, Stakeholder, Metric, Metric command, Scenario lines, Not included, Touches, Test).
2. `npm run item -- metric <slug> --before`, then `npm run item -- propose <slug>`. Show the contract and end your turn with `AWAITING-YES <slug>`. Do nothing else until the stakeholder types a yes.
3. Write the failing test for a Scenario, then `npm run item -- red <slug>`.
4. Implement inside `Touches` only, then `npm run item -- proof <slug>`, then `npm run item -- ship <slug>`.
5. Stop. A human merges the PR. After that: `npm run item -- metric <slug> --after`, then `npm run item -- close <slug>`.

Rules: never type Signed/before/after values; never push, open or merge PRs, or post to Jira/GitHub; draft text for Hassan instead. Code comments never reference `docs/`.
Validation: `npm run type-check`, `npx vitest run`, `npm run check -- apps/todo-api`.
