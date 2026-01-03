import type { ConstructNode, ConstructMetadata } from "./construct.js";
import type {
  TerraformJson,
  TerraformBlock,
  RequiredProvider,
  VariableBlock,
  OutputBlock,
} from "./terraform-json.js";
import type { ResourceDef, LifecycleDef, ConditionDef, ProvisionerDef } from "./resource.js";
import type { DataSourceDef } from "./datasource.js";
import type { ProviderDef } from "./provider.js";
import type { VariableDef, ValidationDef } from "./variable.js";
import type { OutputDef } from "./output.js";
import type { BackendDef } from "./backend.js";
import type { LocalDef } from "./local.js";
import { generateLogicalId } from "./logical-id.js";
import { Token, tokenToHcl } from "./tokens.js";

// --- HCL Serialization ---

const valueToHcl = (value: unknown): unknown => {
  if (value instanceof Token) {
    return tokenToHcl(value);
  }
  if (Array.isArray(value)) {
    return value.map(valueToHcl);
  }
  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = valueToHcl(v);
    }
    return result;
  }
  return value;
};

const configToHcl = (config: Readonly<Record<string, unknown>>): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    result[k] = valueToHcl(v);
  }
  return result;
};

const dependsOnToHcl = (dependsOn: readonly Token[] | undefined): readonly string[] | undefined =>
  dependsOn === undefined || dependsOn.length === 0
    ? undefined
    : dependsOn.map((t) => tokenToHcl(t));

// --- Lifecycle Synthesis ---

const synthesizeCondition = (
  condition: ConditionDef,
): { condition: string; error_message: string } => ({
  condition: tokenToHcl(condition.condition),
  error_message: condition.errorMessage,
});

const synthesizeLifecycle = (
  lifecycle: LifecycleDef | undefined,
): Record<string, unknown> | undefined => {
  if (lifecycle === undefined) {
    return undefined;
  }

  const result: Record<string, unknown> = {};

  if (lifecycle.createBeforeDestroy !== undefined) {
    result["create_before_destroy"] = lifecycle.createBeforeDestroy;
  }
  if (lifecycle.preventDestroy !== undefined) {
    result["prevent_destroy"] = lifecycle.preventDestroy;
  }
  if (lifecycle.ignoreChanges !== undefined) {
    result["ignore_changes"] = lifecycle.ignoreChanges;
  }
  if (lifecycle.replaceTriggeredBy !== undefined) {
    result["replace_triggered_by"] = lifecycle.replaceTriggeredBy.map(tokenToHcl);
  }
  if (lifecycle.precondition !== undefined) {
    result["precondition"] = lifecycle.precondition.map(synthesizeCondition);
  }
  if (lifecycle.postcondition !== undefined) {
    result["postcondition"] = lifecycle.postcondition.map(synthesizeCondition);
  }

  return Object.keys(result).length > 0 ? result : undefined;
};

// --- Provisioner Synthesis ---

const synthesizeProvisioner = (
  provisioner: ProvisionerDef,
): Record<string, Record<string, unknown>> => {
  const result: Record<string, unknown> = {
    ...configToHcl(provisioner.config),
  };

  if (provisioner.when !== undefined) {
    result["when"] = provisioner.when;
  }
  if (provisioner.onFailure !== undefined) {
    result["on_failure"] = provisioner.onFailure;
  }

  return { [provisioner.type]: result };
};

// --- Element Synthesis ---

type ResourceSynthResult = {
  readonly resourceType: string;
  readonly logicalId: string;
  readonly config: Record<string, unknown>;
};

export const synthesizeResource = (
  node: ConstructNode,
  resource: ResourceDef,
): ResourceSynthResult => {
  const logicalId = generateLogicalId(node.path);
  const config = configToHcl(resource.config);

  const result: Record<string, unknown> = { ...config };

  if (resource.provider !== undefined) {
    result["provider"] = resource.provider;
  }

  const dependsOn = dependsOnToHcl(resource.dependsOn);
  if (dependsOn !== undefined) {
    result["depends_on"] = dependsOn;
  }

  if (resource.count !== undefined) {
    result["count"] = valueToHcl(resource.count);
  }

  if (resource.forEach !== undefined) {
    result["for_each"] = tokenToHcl(resource.forEach);
  }

  const lifecycle = synthesizeLifecycle(resource.lifecycle);
  if (lifecycle !== undefined) {
    result["lifecycle"] = lifecycle;
  }

  if (resource.provisioners !== undefined && resource.provisioners.length > 0) {
    result["provisioner"] = resource.provisioners.map(synthesizeProvisioner);
  }

  return {
    resourceType: resource.terraformResourceType,
    logicalId,
    config: result,
  };
};

type ProviderSynthResult = {
  readonly providerName: string;
  readonly config: Record<string, unknown>;
};

export const synthesizeProvider = (provider: ProviderDef): ProviderSynthResult => {
  const config = configToHcl(provider.config);
  const result: Record<string, unknown> = { ...config };

  if (provider.alias !== undefined) {
    result["alias"] = provider.alias;
  }

  const providerName =
    provider.terraformProviderSource.split("/").pop() ?? provider.terraformProviderSource;

  return {
    providerName,
    config: result,
  };
};

type DataSourceSynthResult = {
  readonly dataType: string;
  readonly logicalId: string;
  readonly config: Record<string, unknown>;
};

export const synthesizeDataSource = (
  node: ConstructNode,
  datasource: DataSourceDef,
): DataSourceSynthResult => {
  const logicalId = generateLogicalId(node.path);
  const config = configToHcl(datasource.config);

  const result: Record<string, unknown> = { ...config };

  if (datasource.provider !== undefined) {
    result["provider"] = datasource.provider;
  }

  const dependsOn = dependsOnToHcl(datasource.dependsOn);
  if (dependsOn !== undefined) {
    result["depends_on"] = dependsOn;
  }

  return {
    dataType: datasource.terraformResourceType,
    logicalId,
    config: result,
  };
};

const synthesizeValidation = (
  validation: ValidationDef,
): { condition: string; error_message: string } => ({
  condition: tokenToHcl(validation.condition),
  error_message: validation.errorMessage,
});

export const synthesizeVariable = (
  node: ConstructNode,
  variable: VariableDef,
): { readonly id: string; readonly block: VariableBlock } => {
  const logicalId = generateLogicalId(node.path);

  const block: VariableBlock = {
    ...(variable.type !== undefined && { type: variable.type }),
    ...(variable.default !== undefined && { default: valueToHcl(variable.default) }),
    ...(variable.description !== undefined && { description: variable.description }),
    ...(variable.sensitive !== undefined && { sensitive: variable.sensitive }),
    ...(variable.nullable !== undefined && { nullable: variable.nullable }),
    ...(variable.validation !== undefined &&
      variable.validation.length > 0 && {
        validation: variable.validation.map(synthesizeValidation),
      }),
  };

  return { id: logicalId, block };
};

export const synthesizeOutput = (
  node: ConstructNode,
  output: OutputDef,
): { readonly id: string; readonly block: OutputBlock } => {
  const logicalId = generateLogicalId(node.path);
  const dependsOn = dependsOnToHcl(output.dependsOn);

  const block: OutputBlock = {
    value: valueToHcl(output.value),
    ...(output.description !== undefined && { description: output.description }),
    ...(output.sensitive !== undefined && { sensitive: output.sensitive }),
    ...(dependsOn !== undefined && { depends_on: dependsOn }),
  };

  return { id: logicalId, block };
};

export const synthesizeBackend = (backend: BackendDef): Record<string, Record<string, unknown>> => {
  const config = configToHcl(backend.config);
  return { [backend.type]: config };
};

export const synthesizeLocal = (
  node: ConstructNode,
  local: LocalDef,
): { readonly id: string; readonly value: unknown } => {
  const logicalId = generateLogicalId(node.path);
  return { id: logicalId, value: valueToHcl(local.expression) };
};

// --- Collection Types ---

type ResourceNode = {
  readonly node: ConstructNode;
  readonly resource: ResourceDef;
};

type ProviderNode = {
  readonly node: ConstructNode;
  readonly provider: ProviderDef;
};

type DataSourceNode = {
  readonly node: ConstructNode;
  readonly datasource: DataSourceDef;
};

type VariableNode = {
  readonly node: ConstructNode;
  readonly variable: VariableDef;
};

type OutputNode = {
  readonly node: ConstructNode;
  readonly output: OutputDef;
};

type LocalNode = {
  readonly node: ConstructNode;
  readonly local: LocalDef;
};

type BackendNode = {
  readonly node: ConstructNode;
  readonly backend: BackendDef;
};

// --- Collection Functions ---

const traverseAndCollect = <T>(
  stack: ConstructNode,
  extract: (node: ConstructNode, metadata: ConstructMetadata) => T | undefined,
): readonly T[] => {
  const results: T[] = [];

  const traverse = (node: ConstructNode): void => {
    const extracted = extract(node, node.metadata);
    if (extracted !== undefined) {
      results.push(extracted);
    }
    node.children.forEach(traverse);
  };

  stack.children.forEach(traverse);
  return results;
};

export const collectProviders = (stack: ConstructNode): readonly ProviderNode[] =>
  traverseAndCollect(stack, (node, metadata) =>
    metadata.kind === "provider" ? { node, provider: metadata.provider } : undefined,
  );

export const collectResources = (stack: ConstructNode): readonly ResourceNode[] =>
  traverseAndCollect(stack, (node, metadata) =>
    metadata.kind === "resource" ? { node, resource: metadata.resource } : undefined,
  );

export const collectDataSources = (stack: ConstructNode): readonly DataSourceNode[] =>
  traverseAndCollect(stack, (node, metadata) =>
    metadata.kind === "datasource" ? { node, datasource: metadata.datasource } : undefined,
  );

export const collectVariables = (stack: ConstructNode): readonly VariableNode[] =>
  traverseAndCollect(stack, (node, metadata) =>
    metadata.kind === "variable" ? { node, variable: metadata.variable } : undefined,
  );

export const collectOutputs = (stack: ConstructNode): readonly OutputNode[] =>
  traverseAndCollect(stack, (node, metadata) =>
    metadata.kind === "output" ? { node, output: metadata.output } : undefined,
  );

export const collectLocals = (stack: ConstructNode): readonly LocalNode[] =>
  traverseAndCollect(stack, (node, metadata) =>
    metadata.kind === "local" ? { node, local: metadata.local } : undefined,
  );

export const collectBackends = (stack: ConstructNode): readonly BackendNode[] =>
  traverseAndCollect(stack, (node, metadata) =>
    metadata.kind === "backend" ? { node, backend: metadata.backend } : undefined,
  );

// --- Required Providers ---

export const buildRequiredProviders = (
  providers: readonly ProviderNode[],
): Record<string, RequiredProvider> => {
  const result: Record<string, RequiredProvider> = {};

  for (const { provider } of providers) {
    const providerName =
      provider.terraformProviderSource.split("/").pop() ?? provider.terraformProviderSource;

    if (result[providerName] === undefined) {
      result[providerName] = {
        source: provider.terraformProviderSource,
        ...(provider.version !== undefined && { version: provider.version }),
      };
    }
  }

  return result;
};

// --- Stack Synthesis ---

const mergeProviders = (
  providers: readonly ProviderNode[],
): Record<string, readonly Record<string, unknown>[]> => {
  const result: Record<string, Record<string, unknown>[]> = {};

  for (const { provider } of providers) {
    const { providerName, config } = synthesizeProvider(provider);
    const existing = result[providerName] ?? [];
    result[providerName] = [...existing, config];
  }

  return result;
};

const mergeResources = (
  resources: readonly ResourceNode[],
): Record<string, Record<string, Record<string, unknown>>> => {
  const result: Record<string, Record<string, Record<string, unknown>>> = {};

  for (const { node, resource } of resources) {
    const { resourceType, logicalId, config } = synthesizeResource(node, resource);
    const existing = result[resourceType] ?? {};
    result[resourceType] = { ...existing, [logicalId]: config };
  }

  return result;
};

const mergeDataSources = (
  dataSources: readonly DataSourceNode[],
): Record<string, Record<string, Record<string, unknown>>> => {
  const result: Record<string, Record<string, Record<string, unknown>>> = {};

  for (const { node, datasource } of dataSources) {
    const { dataType, logicalId, config } = synthesizeDataSource(node, datasource);
    const existing = result[dataType] ?? {};
    result[dataType] = { ...existing, [logicalId]: config };
  }

  return result;
};

const mergeVariables = (variables: readonly VariableNode[]): Record<string, VariableBlock> => {
  const result: Record<string, VariableBlock> = {};

  for (const { node, variable } of variables) {
    const { id, block } = synthesizeVariable(node, variable);
    result[id] = block;
  }

  return result;
};

const mergeOutputs = (outputs: readonly OutputNode[]): Record<string, OutputBlock> => {
  const result: Record<string, OutputBlock> = {};

  for (const { node, output } of outputs) {
    const { id, block } = synthesizeOutput(node, output);
    result[id] = block;
  }

  return result;
};

const mergeLocals = (locals: readonly LocalNode[]): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  for (const { node, local } of locals) {
    const { id, value } = synthesizeLocal(node, local);
    result[id] = value;
  }

  return result;
};

export const synthesizeStack = (stack: ConstructNode): TerraformJson => {
  const providers = collectProviders(stack);
  const resources = collectResources(stack);
  const dataSources = collectDataSources(stack);
  const variables = collectVariables(stack);
  const outputs = collectOutputs(stack);
  const locals = collectLocals(stack);
  const backends = collectBackends(stack);

  const requiredProviders = buildRequiredProviders(providers);
  const firstBackend = backends[0];
  const backend = firstBackend !== undefined ? synthesizeBackend(firstBackend.backend) : undefined;

  const terraformBlock: TerraformBlock | undefined =
    Object.keys(requiredProviders).length > 0 || backend !== undefined
      ? {
          ...(Object.keys(requiredProviders).length > 0 && {
            required_providers: requiredProviders,
          }),
          ...(backend !== undefined && { backend }),
        }
      : undefined;

  const providerBlock = providers.length > 0 ? mergeProviders(providers) : undefined;
  const resourceBlock = resources.length > 0 ? mergeResources(resources) : undefined;
  const dataBlock = dataSources.length > 0 ? mergeDataSources(dataSources) : undefined;
  const variableBlock = variables.length > 0 ? mergeVariables(variables) : undefined;
  const outputBlock = outputs.length > 0 ? mergeOutputs(outputs) : undefined;
  const localsBlock = locals.length > 0 ? mergeLocals(locals) : undefined;

  return {
    ...(terraformBlock !== undefined && { terraform: terraformBlock }),
    ...(providerBlock !== undefined && { provider: providerBlock }),
    ...(resourceBlock !== undefined && { resource: resourceBlock }),
    ...(dataBlock !== undefined && { data: dataBlock }),
    ...(variableBlock !== undefined && { variable: variableBlock }),
    ...(outputBlock !== undefined && { output: outputBlock }),
    ...(localsBlock !== undefined && { locals: localsBlock }),
  };
};
