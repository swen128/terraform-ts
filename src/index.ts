export { ok, err, Result } from "neverthrow";

export type {
  Token,
  RefToken,
  FnToken,
  RawToken,
  TokenResolver,
  TokenValue,
} from "./core/tokens.js";
export { TOKEN_SYMBOL } from "./core/tokens.js";

export type { TftsError, ValidationError, ValidationErrorCode } from "./core/errors.js";

export type { ConstructNode, ConstructMetadata } from "./core/construct.js";
export type { ResourceDef, LifecycleDef, ConditionDef, ProvisionerDef } from "./core/resource.js";
export type { DataSourceDef } from "./core/datasource.js";
export type { ProviderDef } from "./core/provider.js";
export type { VariableDef, ValidationDef } from "./core/variable.js";
export type { OutputDef } from "./core/output.js";
export type { BackendDef } from "./core/backend.js";
export type { LocalDef } from "./core/local.js";

export type {
  TerraformJson,
  TerraformBlock,
  RequiredProvider,
  VariableBlock,
  OutputBlock,
} from "./core/terraform-json.js";

export type { CdktfConfig, ProviderConstraint, ModuleConstraint } from "./cli/config.js";

export type {
  ProviderSchema,
  ProviderSchemaEntry,
  ResourceSchema,
  SchemaBlock,
  AttributeSchema,
  BlockTypeSchema,
  SchemaType,
} from "./codegen/schema.js";
