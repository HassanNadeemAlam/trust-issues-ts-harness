import type { Plugin } from "../../core/types.ts";

/**
 * Hassan's code rules, registered through the Assignment 01 plugin API (core/ is untouched).
 * - no-docs-reference: code comments never point into docs/ — that folder lives outside the app repos,
 *   so readers of the code cannot follow the link. I have made this mistake in SF more than once.
 */
export const hassanPlugin: Plugin = {
  name: "hassan",
  lintRules: [
    {
      name: "no-docs-reference",
      check: (file) =>
        file.text.split("\n").flatMap((line, i) =>
          /(\/\/|\/\*|\*).*\bdocs\/(specs|planning|tickets|design|contracts)\b/.test(line)
            ? [{ rule: "no-docs-reference", file: file.path, line: i + 1, message: "comment references docs/, which code readers cannot see" }]
            : [],
        ),
    },
  ],
};
