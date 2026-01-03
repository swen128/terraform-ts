export { ok, err, Result } from "neverthrow";

export type {
  TerraformValue,
  Token,
  RefToken,
  FnToken,
  RawToken,
  TokenResolver,
  TokenValue,
} from "./core/tokens.js";
export {
  TOKEN_SYMBOL,
  ref,
  fn,
  raw,
  tokenToHcl,
  containsTokens,
  resolveTokens,
} from "./core/tokens.js";

export type { TftsError, ValidationError, ValidationErrorCode } from "./core/errors.js";

export type { ConstructNode, ConstructMetadata } from "./core/construct.js";
export { addChild, findNode, walkTree, getChildren } from "./core/tree.js";
export type { ResourceDef, LifecycleDef, ConditionDef, ProvisionerDef } from "./core/resource.js";
export type { DataSourceDef } from "./core/datasource.js";
export type { ProviderDef } from "./core/provider.js";
export type { VariableDef, ValidationDef } from "./core/variable.js";
export type { OutputDef } from "./core/output.js";
export type { BackendDef } from "./core/backend.js";
export type { LocalDef } from "./core/local.js";

export { validateTree, detectCircularDependencies } from "./core/validate.js";

export { generateLogicalId, generateFqn } from "./core/logical-id.js";

export {
  synthesizeResource,
  synthesizeProvider,
  synthesizeDataSource,
  synthesizeVariable,
  synthesizeOutput,
  synthesizeBackend,
  synthesizeLocal,
  synthesizeStack,
  collectProviders,
  collectResources,
  collectDataSources,
  collectVariables,
  collectOutputs,
  collectLocals,
  collectBackends,
  buildRequiredProviders,
} from "./core/synthesize.js";

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

export { Construct } from "./facade/construct.js";
export { App, type AppOptions } from "./facade/app.js";
export { TerraformStack } from "./facade/stack.js";
export {
  TerraformResource,
  type TerraformResourceConfig,
  type TerraformResourceLifecycle,
} from "./facade/resource.js";
export { TerraformProvider, type TerraformProviderConfig } from "./facade/provider.js";
export { TerraformDataSource, type TerraformDataSourceConfig } from "./facade/datasource.js";
export { TerraformVariable, type TerraformVariableConfig } from "./facade/variable.js";
export { TerraformOutput, type TerraformOutputConfig } from "./facade/output.js";
export { TerraformLocal, type TerraformLocalConfig } from "./facade/local.js";
export {
  TerraformBackend,
  LocalBackend,
  type LocalBackendConfig,
  S3Backend,
  type S3BackendConfig,
  GcsBackend,
  type GcsBackendConfig,
  RemoteBackend,
  type RemoteBackendConfig,
} from "./facade/backends/index.js";
