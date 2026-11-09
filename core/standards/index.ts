import type { Check, Finding, Probe, RegistryView, SourceFile } from "../types.ts";
import { sourceFiles } from "../workspace.ts";
import { rfc7807Check } from "./rfc7807.ts";
import { typeSafetyCheck } from "./types.ts";
import { zodCheck } from "./zod.ts";

export interface CheckResult {
  name: string;
  findings: Finding[];
}

/** Runs registered ORM validators and lint rules as one check, so plugins need no engine changes. */
function pluginRulesCheck(registry: RegistryView): Check {
  return {
    name: "plugins",
    run(_ws, files: SourceFile[]) {
      return files.flatMap((f) => [
        ...registry.ormValidators().flatMap((v) => v.validate(f)),
        ...registry.lintRules().flatMap((r) => r.check(f)),
      ]);
    },
  };
}

export async function runStandards(workspace: string, probes: Probe[], registry: RegistryView): Promise<CheckResult[]> {
  const files = sourceFiles(workspace);
  const checks: Check[] = [zodCheck, rfc7807Check(probes), typeSafetyCheck, ...registry.checks(), pluginRulesCheck(registry)];
  const results: CheckResult[] = [];
  for (const c of checks) results.push({ name: c.name, findings: await c.run(workspace, files) });
  return results;
}

/** Compact, model-facing summary: one line per check, at most `limit` findings listed. */
export function summarize(results: CheckResult[], limit = 8): string {
  const lines: string[] = [];
  let listed = 0;
  for (const r of results) {
    lines.push(`${r.findings.length === 0 ? "PASS" : "FAIL"} ${r.name}${r.findings.length ? ` (${r.findings.length})` : ""}`);
    for (const f of r.findings) {
      if (listed++ >= limit) break;
      const loc = f.file ? `${f.file}${f.line ? `:${f.line}` : ""} ` : "";
      lines.push(`  - ${loc}${f.message}`);
    }
  }
  return lines.join("\n");
}

export const allPassed = (results: CheckResult[]) => results.every((r) => r.findings.length === 0);
