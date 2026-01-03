import type { BackendDef } from "./backend.js";
import type { DataSourceDef } from "./datasource.js";
import type { LocalDef } from "./local.js";
import type { OutputDef } from "./output.js";
import type { ProviderDef } from "./provider.js";
import type { ResourceDef } from "./resource.js";
import type { VariableDef } from "./variable.js";

export type ConstructNode = {
  readonly id: string;
  readonly path: readonly string[];
  readonly children: readonly ConstructNode[];
  readonly metadata: ConstructMetadata;
};

export type ConstructMetadata =
  | { readonly kind: "app"; readonly outdir: string }
  | { readonly kind: "stack"; readonly stackName: string }
  | { readonly kind: "resource"; readonly resource: ResourceDef }
  | { readonly kind: "provider"; readonly provider: ProviderDef }
  | { readonly kind: "datasource"; readonly datasource: DataSourceDef }
  | { readonly kind: "variable"; readonly variable: VariableDef }
  | { readonly kind: "output"; readonly output: OutputDef }
  | { readonly kind: "backend"; readonly backend: BackendDef }
  | { readonly kind: "local"; readonly local: LocalDef };
