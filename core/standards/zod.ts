import type { Check, Finding } from "../types.ts";

/** Every route module must validate its input with Zod, and the schema module must use Zod. */
export const zodCheck: Check = {
  name: "zod",
  run(_ws, files) {
    const findings: Finding[] = [];
    const routes = files.filter((f) => f.path.startsWith("src/routes/"));
    if (routes.length === 0) findings.push({ rule: "zod", message: "no route modules under src/routes/" });
    for (const f of routes) {
      const readsInput = /\b(body|params|query)\b/.test(f.text);
      if (readsInput && !/\.(safeParse|parse)\(/.test(f.text))
        findings.push({ rule: "zod", file: f.path, message: "reads request input without Zod parse/safeParse" });
    }
    const usesZod = files.some((f) => /from ["']zod["']/.test(f.text));
    if (!usesZod) findings.push({ rule: "zod", message: "no module imports zod" });
    return findings;
  },
};
