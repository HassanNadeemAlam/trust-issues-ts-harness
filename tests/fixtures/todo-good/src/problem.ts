import type { ZodError } from "zod";

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

export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  errors?: Array<{ path: string; message: string }>;
}

export const json = (status: number, body: unknown): ApiResponse => ({ status, headers: { "content-type": "application/json" }, body });

export const noContent = (): ApiResponse => ({ status: 204, headers: {}, body: undefined });

export function problem(status: number, title: string, detail?: string, errors?: Problem["errors"]): ApiResponse {
  const body: Problem = { type: status === 500 ? "about:blank" : `https://errors.todo.local/${status}`, title, status };
  if (detail !== undefined) body.detail = detail;
  if (errors) body.errors = errors;
  return { status, headers: { "content-type": "application/problem+json" }, body };
}

export const validationProblem = (error: ZodError): ApiResponse =>
  problem(400, "Validation failed", "The request did not match the schema.", error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
