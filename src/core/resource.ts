import type { Token } from "./tokens.js";

export type ResourceDef = {
  readonly terraformResourceType: string;
  readonly provider?: string;
  readonly dependsOn?: readonly Token[];
  readonly count?: number | Token;
  readonly forEach?: Token;
  readonly lifecycle?: LifecycleDef;
  readonly provisioners?: readonly ProvisionerDef[];
  readonly config: Readonly<Record<string, unknown>>;
};

export type LifecycleDef = {
  readonly createBeforeDestroy?: boolean;
  readonly preventDestroy?: boolean;
  readonly ignoreChanges?: readonly string[] | "all";
  readonly replaceTriggeredBy?: readonly Token[];
  readonly precondition?: readonly ConditionDef[];
  readonly postcondition?: readonly ConditionDef[];
};

export type ConditionDef = {
  readonly condition: Token;
  readonly errorMessage: string;
};

export type ProvisionerDef = {
  readonly type: "local-exec" | "remote-exec" | "file";
  readonly config: Readonly<Record<string, unknown>>;
  readonly when?: "create" | "destroy";
  readonly onFailure?: "continue" | "fail";
};
