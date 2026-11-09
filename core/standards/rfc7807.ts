import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Check, Finding, Probe } from "../types.ts";

export interface ApiRequest {
  method: string;
  path: string;
  body?: unknown;
}
export interface ApiResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}
type Handle = (req: ApiRequest) => Promise<ApiResponse>;

export function isProblem(body: unknown, status: number): string | undefined {
  if (typeof body !== "object" || body === null) return "body is not an object";
  const b = body as Record<string, unknown>;
  if (typeof b.type !== "string") return "missing string `type`";
  if (typeof b.title !== "string") return "missing string `title`";
  if (b.status !== status) return `\`status\` ${String(b.status)} != HTTP ${status}`;
  if (b.detail !== undefined && typeof b.detail !== "string") return "`detail` must be a string";
  return undefined;
}

/** Runs the task's probes against src/app.ts `handle` and requires every error to be an RFC 7807 problem. */
export function rfc7807Check(probes: Probe[]): Check {
  return {
    name: "rfc7807",
    async run(ws) {
      const entry = join(ws, "src/app.ts");
      if (!existsSync(entry)) return [{ rule: "rfc7807", file: "src/app.ts", message: "missing; must export handle()" }];
      let handle: Handle;
      try {
        const mod = (await import(pathToFileURL(entry).href + `?t=${Date.now()}`)) as { handle?: Handle };
        if (typeof mod.handle !== "function") return [{ rule: "rfc7807", file: "src/app.ts", message: "does not export handle()" }];
        handle = mod.handle;
      } catch (e) {
        return [{ rule: "rfc7807", file: "src/app.ts", message: `failed to load: ${(e as Error).message.slice(0, 160)}` }];
      }
      const findings: Finding[] = [];
      for (const p of probes) {
        const label = `${p.method} ${p.path}`;
        let res: ApiResponse;
        try {
          res = await handle({ method: p.method, path: p.path, body: p.body });
        } catch (e) {
          findings.push({ rule: "rfc7807", message: `${label} threw: ${(e as Error).message.slice(0, 120)}` });
          continue;
        }
        if (res.status !== p.expectStatus) findings.push({ rule: "rfc7807", message: `${label} → ${res.status}, expected ${p.expectStatus}` });
        if (res.status >= 400) {
          const ct = res.headers["content-type"] ?? res.headers["Content-Type"];
          if (ct !== "application/problem+json") findings.push({ rule: "rfc7807", message: `${label} content-type ${String(ct)}` });
          const why = isProblem(res.body, res.status);
          if (why) findings.push({ rule: "rfc7807", message: `${label} ${why}` });
        }
      }
      return findings;
    },
  };
}
