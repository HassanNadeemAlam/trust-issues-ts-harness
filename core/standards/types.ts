import ts from "typescript";
import { join } from "node:path";
import type { Check, Finding } from "../types.ts";

const BANNED: Array<[RegExp, string]> = [
  [/:\s*any\b/, "explicit `any` annotation"],
  [/\bas\s+any\b/, "`as any` cast"],
  [/<any>/, "`<any>` cast"],
  [/@ts-(ignore|nocheck)/, "type-check suppression"],
];

/** Compiles the workspace under strict settings and bans escape hatches. */
export const typeSafetyCheck: Check = {
  name: "types",
  run(ws, files) {
    const findings: Finding[] = [];
    for (const f of files)
      f.text.split("\n").forEach((line, i) => {
        for (const [re, msg] of BANNED) if (re.test(line)) findings.push({ rule: "types", file: f.path, line: i + 1, message: msg });
      });
    const program = ts.createProgram(
      files.map((f) => join(ws, f.path)),
      {
        strict: true,
        noUncheckedIndexedAccess: true,
        noImplicitReturns: true,
        noEmit: true,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        allowImportingTsExtensions: true,
        skipLibCheck: true,
        types: ["node"],
        typeRoots: [join(process.cwd(), "node_modules/@types")],
        baseUrl: process.cwd(),
        paths: { zod: [join(process.cwd(), "node_modules/zod")] },
      },
    );
    for (const d of ts.getPreEmitDiagnostics(program)) {
      const pos = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start) : undefined;
      findings.push({
        rule: "types",
        file: d.file ? d.file.fileName.replace(ws + "/", "") : undefined,
        line: pos ? pos.line + 1 : undefined,
        message: ts.flattenDiagnosticMessageText(d.messageText, " "),
      });
    }
    return findings;
  },
};
