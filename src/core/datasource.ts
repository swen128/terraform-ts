import type { Token } from "./tokens.js";

export type DataSourceDef = {
  readonly terraformResourceType: string;
  readonly provider?: string;
  readonly dependsOn?: readonly Token[];
  readonly config: Readonly<Record<string, unknown>>;
};
