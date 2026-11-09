import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { Finding, Plugin } from "../../core/types.ts";
import { listFiles } from "../../core/workspace.ts";

/**
 * Demonstrates every extension point. Registered from harness.config.ts; no file under core/ changes.
 * - tool: list_routes — compact route map, so the model need not read whole route files
 * - ORM validator: db-access — data access only through db.<table>.<method>(), never reset() outside tests
 * - lint rule: no-console — generated APIs must not log with console.*
 */
export const examplePlugin: Plugin = {
  name: "example",
  tools: [
    {
      name: "list_routes",
      description: "List exported handler functions per route module (name and line only).",
      schema: z.object({}),
      run: (_args, { workspace }) =>
        listFiles(workspace)
          .filter((p) => p.startsWith("src/routes/"))
          .flatMap((p) =>
            readFileSync(join(workspace, p), "utf8")
              .split("\n")
              .flatMap((l, i) => {
                const m = /export (?:async )?function (\w+)/.exec(l);
                return m ? [`${p}:${i + 1} ${m[1]}`] : [];
              }),
          )
          .join("\n") || "(no routes)",
    },
  ],
  ormValidators: [
    {
      name: "db-access",
      validate(file) {
        if (file.path === "src/db.ts") return [];
        const out: Finding[] = [];
        file.text.split("\n").forEach((line, i) => {
          if (/\bdb\.\w+\.reset\(/.test(line)) out.push({ rule: "db-access", file: file.path, line: i + 1, message: "reset() is test-only" });
          if (/\b(rows|\.raw\(|sql`)/.test(line)) out.push({ rule: "db-access", file: file.path, line: i + 1, message: "bypasses db.<table> methods" });
        });
        return out;
      },
    },
  ],
  lintRules: [
    {
      name: "no-console",
      check: (file) =>
        file.text.split("\n").flatMap((line, i) =>
          /\bconsole\.(log|debug|info|warn|error)\(/.test(line) ? [{ rule: "no-console", file: file.path, line: i + 1, message: "console.* in API code" }] : [],
        ),
    },
  ],
};
