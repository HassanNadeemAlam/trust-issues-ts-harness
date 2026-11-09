import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { SourceFile } from "./types.ts";

const SKIP = new Set(["node_modules", ".git", "dist"]);

export function listFiles(root: string, dir = root): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(root, full) : [relative(root, full).split(sep).join("/")];
  });
}

export function sourceFiles(workspace: string): SourceFile[] {
  return listFiles(workspace)
    .filter((p) => p.startsWith("src/") && p.endsWith(".ts"))
    .map((path) => ({ path, text: readFileSync(join(workspace, path), "utf8") }));
}

/** Resolves a model-supplied path and refuses anything outside the workspace. */
export function safePath(workspace: string, path: string): string {
  const full = resolve(workspace, path);
  if (full !== resolve(workspace) && !full.startsWith(resolve(workspace) + sep)) throw new Error(`Path escapes workspace: ${path}`);
  return full;
}

export function writeWorkspaceFile(workspace: string, path: string, content: string): void {
  const full = safePath(workspace, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

export function prepareWorkspace(template: string, target: string): string {
  mkdirSync(target, { recursive: true });
  cpSync(template, target, { recursive: true });
  return target;
}
