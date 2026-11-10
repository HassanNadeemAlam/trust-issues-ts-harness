import { spawnSync } from "node:child_process";
import { root } from "./paths.ts";

export interface RunOut {
  code: number;
  out: string;
}

export function sh(command: string, opts: { allowFail?: boolean } = {}): RunOut {
  const r = spawnSync(command, { shell: true, cwd: root(), encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (!opts.allowFail && r.status !== 0) throw new Error(`\`${command}\` failed (${r.status}):\n${out.slice(-1500)}`);
  return { code: r.status ?? 1, out };
}

export const tail = (s: string, n = 25) => s.trim().split("\n").slice(-n).join("\n");

/** Runs a program with an argument list and no shell, so text from contracts is never interpreted. */
export function run(file: string, args: string[], opts: { allowFail?: boolean } = {}): RunOut {
  const r = spawnSync(file, args, { cwd: root(), encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (!opts.allowFail && r.status !== 0) throw new Error(`\`${file} ${args.join(" ")}\` failed (${r.status}):\n${out.slice(-1500)}`);
  return { code: r.status ?? 1, out };
}

export const stdout = (file: string, args: string[]) => {
  const r = spawnSync(file, args, { cwd: root(), encoding: "utf8", env: process.env });
  if (r.status !== 0) throw new Error(`\`${file} ${args.join(" ")}\` failed (${r.status}):\n${(r.stderr ?? "").slice(-800)}`);
  return r.stdout ?? "";
};
