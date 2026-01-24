import type { IResolvable } from "../core/tokens.js";

export type ITerraformDependable = {
  readonly fqn: string;
};

export type IInterpolatingParent = {
  interpolationForAttribute(terraformAttribute: string): IResolvable;
};
