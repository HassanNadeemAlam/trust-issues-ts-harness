import { examplePlugin } from "./plugins/example/index.ts";
import type { Plugin } from "./core/types.ts";

/** Extension point. Add plugins here; nothing under core/ needs to change. */
export const plugins: Plugin[] = [examplePlugin];
