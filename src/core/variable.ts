import type { Token } from "./tokens.js";

export type VariableDef = {
  readonly type?: string;
  readonly default?: unknown;
  readonly description?: string;
  readonly sensitive?: boolean;
  readonly nullable?: boolean;
  readonly validation?: readonly ValidationDef[];
};

export type ValidationDef = {
  readonly condition: Token;
  readonly errorMessage: string;
};
