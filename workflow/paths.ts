import { join } from "node:path";

/** Repo root for hooks (Claude Code sets CLAUDE_PROJECT_DIR) and for the CLI (cwd). Overridable in tests. */
export const root = () => process.env.HARNESS_ROOT ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
export const harnessDir = () => join(root(), ".harness");
export const ledgerPath = () => join(harnessDir(), "ledger.jsonl");
export const activePath = () => join(harnessDir(), "active");
export const contractPath = (slug: string) => join(root(), "docs/contracts", `${slug}.md`);

export function globToRegExp(glob: string): RegExp {
  const re = glob
    .trim()
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\/?/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*");
  return new RegExp(`^${re}$`);
}
