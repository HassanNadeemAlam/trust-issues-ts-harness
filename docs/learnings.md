# Learnings

Three items went through the harness on 9–10 Nov 2026: `reject-blank-titles` (5 → 0), `paginate-todos` (1000 → 50) and `add-priority` (1 → 3). Every step is in `.harness/ledger.jsonl`, and `npm run outcome -- <slug>` reports OK for all three.

## What it caught

- **Its own bugs, before they turned into false records.** On item 1, `ship` saved the shell error `/bin/sh: title: command not found` as the PR url, because backticks in a Scenario ran inside a double-quoted shell command. `metric --after` then could not confirm the merge, and the item stayed open. The agent could not patch the ledger, the contract or `workflow/`, so it stopped and reported the bug. Fixed in PR #2.
- **A proof that could never match.** On item 2, `ship` refused twice with "tree changed after proof" (ledger seq 16 and 18). `proof` wrote its own ledger line after taking the snapshot. The gate refused correctly; the fingerprint was wrong. Fixed in PR #4.
- **Red before green held on all three items.** Each `red` run exited 1 before any source edit was allowed.

## What it got wrong

- **Shell interpolation in the ship step.** It cut PR #1's title and the `a5f5df0` commit subject off at the backtick, and left a literal `\n` in that subject. That history stays as it is, because the brief forbids force-pushing.
- **Too much in one commit.** The first ship ran `git add -A`, so the two other items' draft contracts and `docs/ticket-status.md` went out with item 1.
- **Records after a merge had nowhere to go.** `close` left ledger lines uncommitted on `main`, and the agent was blocked from `git pull`, which is a shell write. I had to pull by hand twice before `item sync` existed.
- **`.harness/active` was committed.** `main` then named a finished item as active.

## What I removed

- Every `sh()` call that built a git or gh command from contract text. They now run with argument lists (`workflow/run.ts#run`).
- Parsing the PR url from the last line of output. The PR is now looked up by branch on GitHub.
- PR body files inside `.harness/`, and the tracked `.harness/active`.

## What is still weak

- **I am my own stakeholder.** The yes gate proves a human typed "Yes approved" / "yes" after the proposal. It cannot prove who typed it, and here it was the same person who owns the work. A second person would make this gate mean what it says.
- **The merges carry my login.** PRs #2 and #4–#8 were merged with `gh` from an agent session at my request, so GitHub records them under my account. The ledger cannot tell that apart from a merge in the browser.
- **The shell-write gate is a pattern match.** It is not a sandbox.
- **Only the `claude-code` driver has a live run.** The Claude and OpenAI API drivers are tested over mocked HTTP; I have no keys. They are UNPROVEN live.

## What I would add next

1. Hook refusals logged to the ledger. Today only CLI refusals are recorded, so I cannot count how often the edit gate fired.
2. An approver identity check: a signed yes from the stakeholder's own GitHub account (a PR review approval on a contract PR) instead of terminal text.
3. A `ship` dry run in CI that runs a contract full of shell metacharacters through the commit, PR and record steps.
