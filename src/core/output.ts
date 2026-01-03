import type { Token } from "./tokens.js";

export type OutputDef = {
  readonly value: unknown;
  readonly description?: string;
  readonly sensitive?: boolean;
  readonly dependsOn?: readonly Token[];
};
