/**
 * Hassan's standing rules, as data the hooks read. Each entry traces to docs/workflow.md "What breaks".
 */
export const policy = {
  /** Files the agent may never edit: the gates themselves and the evidence they write. */
  harnessOwned: [".harness/**", "hooks/**", "checks/**", "workflow/**", ".claude/settings.json", ".claude/settings.local.json", "docs/evidence/**"],
  /** Frozen historical records: read, never add to (docs/tickets, docs/design in the SF workspace). */
  frozen: ["docs/tickets/**", "docs/design/**", "*.dump"],
  /** Edits that need no contract: specs, contracts and notes. */
  docs: ["docs/**", "README.md", "*.md"],
  /** Outward-facing writes: drafted for me, posted by me. */
  externalPostTools: [
    /^mcp__atlassian__(addCommentToJiraIssue|transitionJiraIssue|editJiraIssue|createJiraIssue|addWorklogToJiraIssue|createConfluence\w*|updateConfluencePage)$/,
    /^mcp__github__(create_pull_request|merge_pull_request|add_issue_comment|add_comment_to_pending_review|pull_request_review_write|update_pull_request|push_files|create_or_update_file|delete_file)$/,
    /^mcp__.*(slack|teams).*__(send|post)\w*$/i,
  ],
  /** Shell the agent may never run itself. */
  forbiddenShell: [
    { re: /\bgit\s+push\b/, why: "the agent never pushes; `npm run item -- ship` pushes a feature branch after every gate is clear" },
    { re: /\bgh\s+pr\s+(create|merge|comment|review|edit|close)\b/, why: "PRs are opened by the ship step and merged by a human" },
    { re: /\bgh\s+(issue|api)\b.*\b(comment|POST|PATCH|-X)\b/i, why: "outward posts are drafted for Hassan to send" },
    { re: /\b(npm|yarn|pnpm)\s+run\s+\S*(backfill|sync|seed|cleanup|import|migrate)\S*/i, why: "data-mutating scripts need explicit approval outside the agent" },
    { re: /\b(psql|mysql|sqlite3|mongosh)\b[^|]*\b(insert|update|delete|drop|truncate|alter)\b/i, why: "no direct writes to a database" },
    { re: /\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f|checkout\s+--\s|restore\s)/, why: "discards work; do it by hand if you mean it" },
    { re: /(^|\s)--no-verify\b/, why: "pre-commit hooks are not skipped" },
    { re: /(^|[\s;&|])(rm|mv|cp)\b[^;&|]*\.harness/, why: "the ledger is harness-owned" },
    { re: /(>|tee\s)[^;&|]*\.harness\//, why: "the ledger is harness-owned" },
  ],
  /** Shell that writes files. Treated like an Edit when the gates are not clear. */
  shellWrites: /(^|[^<>2&])>{1,2}\s*[^\s&>]|\btee\b|\bsed\s+-i\b|\bperl\s+-[a-z]*i|\b(cp|mv|rm|touch|truncate|install|patch)\s|\bgit\s+(apply|am|checkout|cherry-pick|merge|rebase)\b|writeFile|open\([^)]*['"]w/,
};
