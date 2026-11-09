import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { listFiles, safePath, writeWorkspaceFile } from "../workspace.ts";
import type { Tool } from "../types.ts";

export const STANDARDS_DIR = join(import.meta.dirname, "../../standards");
const MAX_LINES = 80;
const MAX_LINE_CHARS = 160;

const clip = (s: string, n = MAX_LINE_CHARS) => (s.length > n ? s.slice(0, n) + "…" : s);

export function availableStandards(): string[] {
  return readdirSync(STANDARDS_DIR).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""));
}

/**
 * Just-in-time context tools. Nothing about the workspace or the standards is put in the prompt up front;
 * the model fetches what it needs, and every return is bounded.
 */
export const jitTools: Tool[] = [
  {
    name: "list_files",
    description: "List workspace file paths (optionally under a prefix). Returns paths only.",
    schema: z.object({ prefix: z.string().optional().describe("e.g. src/routes/") }),
    run: ({ prefix }, { workspace }) => {
      const files = listFiles(workspace).filter((p) => !prefix || p.startsWith(prefix));
      return files.length ? files.slice(0, 50).join("\n") + (files.length > 50 ? `\n…+${files.length - 50}` : "") : "(none)";
    },
  },
  {
    name: "read_file",
    description: `Read a line range of a workspace file (max ${MAX_LINES} lines per call). Lines are numbered.`,
    schema: z.object({ path: z.string(), start: z.number().optional(), end: z.number().optional() }),
    run: ({ path, start, end }, { workspace }) => {
      const full = safePath(workspace, path);
      if (!existsSync(full)) return `not found: ${path}`;
      const lines = readFileSync(full, "utf8").split("\n");
      const from = Math.max(1, start ?? 1);
      const to = Math.min(lines.length, end ?? from + MAX_LINES - 1, from + MAX_LINES - 1);
      const body = lines.slice(from - 1, to).map((l, i) => `${from + i}| ${clip(l)}`).join("\n");
      return to < lines.length ? `${body}\n… ${lines.length - to} more lines` : body;
    },
  },
  {
    name: "search",
    description: "Regex search across workspace files. Returns up to 20 `path:line: text` matches.",
    schema: z.object({ pattern: z.string() }),
    run: ({ pattern }, { workspace }) => {
      const re = new RegExp(pattern);
      const hits: string[] = [];
      for (const p of listFiles(workspace)) {
        readFileSync(join(workspace, p), "utf8").split("\n").forEach((l, i) => {
          if (hits.length < 20 && re.test(l)) hits.push(`${p}:${i + 1}: ${clip(l.trim(), 100)}`);
        });
      }
      return hits.join("\n") || "(no matches)";
    },
  },
  {
    name: "get_standard",
    description: "Fetch one standard the generated API must meet.",
    schema: z.object({ name: z.string().describe("api-contract | zod | rfc7807 | types") }),
    run: ({ name }) => {
      const file = join(STANDARDS_DIR, `${name.replace(/[^a-z0-9-]/gi, "")}.md`);
      return existsSync(file) ? readFileSync(file, "utf8") : `unknown standard; available: ${availableStandards().join(", ")}`;
    },
  },
  {
    name: "write_file",
    description: "Create or overwrite a workspace file with the full content.",
    schema: z.object({ path: z.string(), content: z.string() }),
    run: ({ path, content }, { workspace }) => {
      writeWorkspaceFile(workspace, path, content);
      return `wrote ${path} (${content.split("\n").length} lines)`;
    },
  },
];
