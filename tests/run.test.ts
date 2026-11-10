import { describe, expect, it } from "vitest";
import { run } from "../workflow/run.ts";

describe("harness subprocesses", () => {
  it("pass contract text to git/gh literally, with no shell expansion", () => {
    const text = "WHEN x THEN a 400 naming `title` and $(whoami) and \"quotes\"";
    const out = run(process.execPath, ["-e", "process.stdout.write(process.argv[1])", text]).out;
    expect(out).toBe(text);
  });
});
