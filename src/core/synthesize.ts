import type {
  ConditionBlock,
  LifecycleBlock,
  ModuleBlock,
  OutputBlock,
  RequiredProvider,
  TerraformBlock,
  TerraformJson,
  VariableBlock,
} from "./terraform-json.js";
import { resolveTokens, type Token, tokenToString } from "./tokens.js";
import { getDescendants } from "./tree.js";
import type { ConstructNode, DataSourceDef, ResourceDef } from "./types.js";

export function synthesizeStack(stack: ConstructNode): TerraformJson {
  if (stack.metadata.kind !== "stack") {
    throw new Error("Can only synthesize stack nodes");
  }

  const providers = getDescendants(stack, "provider");
  const resources = getDescendants(stack, "resource");
  const dataSources = getDescendants(stack, "datasource");
  const variables = getDescendants(stack, "variable");
  const outputs = getDescendants(stack, "output");
  const locals = getDescendants(stack, "local");
  const modules = getDescendants(stack, "module");
  const backends = getDescendants(stack, "backend");

  const result: TerraformJson = {
    "//": {
      metadata: {
        version: "0.0.0",
        stackName: stack.metadata.stackName,
        backend:
          backends.length > 0 && backends[0]?.metadata.kind === "backend"
            ? backends[0].metadata.backend.type
            : "local",
      },
    },
  };

  const terraformBlock = buildTerraformBlock(providers, backends);
  if (Object.keys(terraformBlock).length > 0) {
    (result as { terraform: TerraformBlock }).terraform = terraformBlock;
  }

  const providerBlock = buildProviderBlock(providers);
  if (Object.keys(providerBlock).length > 0) {
    (result as { provider: Record<string, readonly Record<string, unknown>[]> }).provider =
      providerBlock;
  }

  const resourceBlock = buildResourceBlock(resources);
  if (Object.keys(resourceBlock).length > 0) {
    (result as { resource: Record<string, Record<string, Record<string, unknown>>> }).resource =
      resourceBlock;
  }

  const dataBlock = buildDataBlock(dataSources);
  if (Object.keys(dataBlock).length > 0) {
    (result as { data: Record<string, Record<string, Record<string, unknown>>> }).data = dataBlock;
  }

  const variableBlock = buildVariableBlock(variables);
  if (Object.keys(variableBlock).length > 0) {
    (result as { variable: Record<string, VariableBlock> }).variable = variableBlock;
  }

  const outputBlock = buildOutputBlock(outputs);
  if (Object.keys(outputBlock).length > 0) {
    (result as { output: Record<string, OutputBlock> }).output = outputBlock;
  }

  const localsBlock = buildLocalsBlock(locals);
  if (Object.keys(localsBlock).length > 0) {
    (result as { locals: Record<string, unknown> }).locals = localsBlock;
  }

  const moduleBlock = buildModuleBlock(modules);
  if (Object.keys(moduleBlock).length > 0) {
    (result as { module: Record<string, ModuleBlock> }).module = moduleBlock;
  }

  return resolveAllTokens(result);
}

function buildTerraformBlock(
  providers: readonly ConstructNode[],
  backends: readonly ConstructNode[],
): TerraformBlock {
  const result: TerraformBlock = {};

  const requiredProviders: Record<string, RequiredProvider> = {};

  for (const provider of providers) {
    if (provider.metadata.kind !== "provider") continue;

    const { terraformProviderSource, version } = provider.metadata.provider;
    const [, name] = parseProviderSource(terraformProviderSource);

    if (name && !requiredProviders[name]) {
      requiredProviders[name] = {
        source: terraformProviderSource,
        ...(version ? { version } : {}),
      };
    }
  }

  if (Object.keys(requiredProviders).length > 0) {
    (result as { required_providers: Record<string, RequiredProvider> }).required_providers =
      requiredProviders;
  }

  if (backends.length > 0) {
    const backend = backends[0];
    if (backend?.metadata.kind === "backend") {
      const { type, config } = backend.metadata.backend;
      (result as { backend: Record<string, Record<string, unknown>> }).backend = {
        [type]: config,
      };
    }
  }

  return result;
}

function buildProviderBlock(
  providers: readonly ConstructNode[],
): Record<string, readonly Record<string, unknown>[]> {
  const result: Record<string, Record<string, unknown>[]> = {};

  for (const provider of providers) {
    if (provider.metadata.kind !== "provider") continue;

    const { terraformProviderSource, alias, config } = provider.metadata.provider;
    const [, name] = parseProviderSource(terraformProviderSource);

    if (!name) continue;

    if (!result[name]) {
      result[name] = [];
    }

    const providerConfig: Record<string, unknown> = { ...config };
    if (alias) {
      providerConfig["alias"] = alias;
    }

    result[name].push(providerConfig);
  }

  return result;
}

function buildResourceBlock(
  resources: readonly ConstructNode[],
): Record<string, Record<string, Record<string, unknown>>> {
  const result: Record<string, Record<string, Record<string, unknown>>> = {};

  for (const resource of resources) {
    if (resource.metadata.kind !== "resource") continue;

    const def = resource.metadata.resource;
    const logicalId = generateLogicalId(resource.path);

    if (!result[def.terraformResourceType]) {
      result[def.terraformResourceType] = {};
    }

    const resourceTypeBlock = result[def.terraformResourceType];
    if (resourceTypeBlock) {
      resourceTypeBlock[logicalId] = synthesizeResource(def, resource);
    }
  }

  return result;
}

function buildDataBlock(
  dataSources: readonly ConstructNode[],
): Record<string, Record<string, Record<string, unknown>>> {
  const result: Record<string, Record<string, Record<string, unknown>>> = {};

  for (const dataSource of dataSources) {
    if (dataSource.metadata.kind !== "datasource") continue;

    const def = dataSource.metadata.datasource;
    const logicalId = generateLogicalId(dataSource.path);

    const resourceType = def.terraformResourceType;
    const existing = result[resourceType];
    const dataTypeBlock = existing ?? {};
    dataTypeBlock[logicalId] = synthesizeDataSource(def);
    result[resourceType] = dataTypeBlock;
  }

  return result;
}

function buildVariableBlock(variables: readonly ConstructNode[]): Record<string, VariableBlock> {
  const result: Record<string, VariableBlock> = {};

  for (const variable of variables) {
    if (variable.metadata.kind !== "variable") continue;

    const logicalId = generateLogicalId(variable.path);
    result[logicalId] = synthesizeVariable(variable.metadata.variable);
  }

  return result;
}

function buildOutputBlock(outputs: readonly ConstructNode[]): Record<string, OutputBlock> {
  const result: Record<string, OutputBlock> = {};

  for (const output of outputs) {
    if (output.metadata.kind !== "output") continue;

    const logicalId = generateLogicalId(output.path);
    result[logicalId] = synthesizeOutput(output.metadata.output);
  }

  return result;
}

function buildLocalsBlock(locals: readonly ConstructNode[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const local of locals) {
    if (local.metadata.kind !== "local") continue;

    const logicalId = generateLogicalId(local.path);
    result[logicalId] = local.metadata.local.expression;
  }

  return result;
}

function buildModuleBlock(modules: readonly ConstructNode[]): Record<string, ModuleBlock> {
  const result: Record<string, ModuleBlock> = {};

  for (const module of modules) {
    if (module.metadata.kind !== "module") continue;

    const logicalId = generateLogicalId(module.path);
    const def = module.metadata.module;

    const moduleBlock: ModuleBlock = {
      source: def.source,
      ...(def.version ? { version: def.version } : {}),
      ...(def.providers ? { providers: def.providers } : {}),
      ...(def.dependsOn?.length ? { depends_on: def.dependsOn } : {}),
      ...(def.forEach ? { for_each: def.forEach } : {}),
      ...(def.count !== undefined ? { count: def.count } : {}),
      ...def.variables,
    };

    result[logicalId] = moduleBlock;
  }

  return result;
}

function synthesizeResource(def: ResourceDef, node: ConstructNode): Record<string, unknown> {
  const result: Record<string, unknown> = {
    ...keysToSnakeCase(def.config),
  };

  if (def.dependsOn?.length) {
    result["depends_on"] = def.dependsOn;
  }

  if (def.count !== undefined) {
    result["count"] = def.count;
  }

  if (def.forEach) {
    result["for_each"] = def.forEach;
  }

  if (def.provider) {
    result["provider"] = def.provider;
  }

  if (def.lifecycle) {
    result["lifecycle"] = synthesizeLifecycle(def.lifecycle);
  }

  if (def.provisioners?.length) {
    result["provisioner"] = def.provisioners.map((p) => ({
      [p.type]: {
        ...keysToSnakeCase(p.config),
        ...(p.when ? { when: p.when } : {}),
        ...(p.onFailure ? { on_failure: p.onFailure } : {}),
        ...(p.connection ? { connection: keysToSnakeCase(p.connection) } : {}),
      },
    }));
  }

  if (def.connection) {
    result["connection"] = keysToSnakeCase(def.connection);
  }

  if (def.overrides) {
    Object.assign(result, def.overrides);
  }

  result["//"] = {
    metadata: {
      path: node.path.join("/"),
      uniqueId: generateLogicalId(node.path),
    },
  };

  return result;
}

function synthesizeDataSource(def: DataSourceDef): Record<string, unknown> {
  const result: Record<string, unknown> = {
    ...keysToSnakeCase(def.config),
  };

  if (def.dependsOn?.length) {
    result["depends_on"] = def.dependsOn;
  }

  if (def.count !== undefined) {
    result["count"] = def.count;
  }

  if (def.forEach) {
    result["for_each"] = def.forEach;
  }

  if (def.provider) {
    result["provider"] = def.provider;
  }

  return result;
}

function synthesizeVariable(def: import("./types.js").VariableDef): VariableBlock {
  const result: VariableBlock = {};

  if (def.type) {
    (result as { type: string }).type = def.type;
  }

  if (def.default !== undefined) {
    (result as { default: unknown }).default = def.default;
  }

  if (def.description) {
    (result as { description: string }).description = def.description;
  }

  if (def.sensitive !== undefined) {
    (result as { sensitive: boolean }).sensitive = def.sensitive;
  }

  if (def.nullable !== undefined) {
    (result as { nullable: boolean }).nullable = def.nullable;
  }

  if (def.validation?.length) {
    (result as { validation: { condition: string; error_message: string }[] }).validation =
      def.validation.map((v) => ({
        condition: v.condition,
        error_message: v.errorMessage,
      }));
  }

  return result;
}

function synthesizeOutput(def: import("./types.js").OutputDef): OutputBlock {
  const result: OutputBlock = {
    value: def.value,
  };

  if (def.description) {
    (result as { description: string }).description = def.description;
  }

  if (def.sensitive !== undefined) {
    (result as { sensitive: boolean }).sensitive = def.sensitive;
  }

  if (def.dependsOn?.length) {
    (result as { depends_on: readonly string[] }).depends_on = def.dependsOn;
  }

  if (def.precondition) {
    (result as { precondition: ConditionBlock }).precondition = {
      condition: def.precondition.condition,
      error_message: def.precondition.errorMessage,
    };
  }

  return result;
}

function synthesizeLifecycle(def: import("./types.js").LifecycleDef): LifecycleBlock {
  const result: LifecycleBlock = {};

  if (def.createBeforeDestroy !== undefined) {
    (result as { create_before_destroy: boolean }).create_before_destroy = def.createBeforeDestroy;
  }

  if (def.preventDestroy !== undefined) {
    (result as { prevent_destroy: boolean }).prevent_destroy = def.preventDestroy;
  }

  if (def.ignoreChanges) {
    (result as { ignore_changes: readonly string[] | "all" }).ignore_changes = def.ignoreChanges;
  }

  if (def.replaceTriggeredBy?.length) {
    (result as { replace_triggered_by: readonly string[] }).replace_triggered_by =
      def.replaceTriggeredBy;
  }

  if (def.precondition?.length) {
    (result as { precondition: readonly ConditionBlock[] }).precondition = def.precondition.map(
      (c) => ({
        condition: c.condition,
        error_message: c.errorMessage,
      }),
    );
  }

  if (def.postcondition?.length) {
    (result as { postcondition: readonly ConditionBlock[] }).postcondition = def.postcondition.map(
      (c) => ({
        condition: c.condition,
        error_message: c.errorMessage,
      }),
    );
  }

  return result;
}

export function generateLogicalId(path: readonly string[]): string {
  if (path.length === 0) {
    return "";
  }

  if (path.length === 1) {
    return path[0] ?? "";
  }

  const stackIndex = 1;
  const components = path.slice(stackIndex);

  if (components.length === 1) {
    return components[0] ?? "";
  }

  return makeUniqueId(components);
}

function makeUniqueId(components: readonly string[]): string {
  const hash = simpleHash(components.join("/"));
  const lastComponent = components[components.length - 1] ?? "";
  return `${lastComponent}_${hash.slice(0, 8)}`;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export function generateFqn(resourceType: string, logicalId: string): string {
  return `${resourceType}.${logicalId}`;
}

function parseProviderSource(source: string): [string, string] {
  const parts = source.split("/");
  if (parts.length === 2) {
    return [parts[0] ?? "", parts[1] ?? ""];
  }
  return ["", source];
}

function keysToSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = camelToSnake(key);

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[snakeKey] = keysToSnakeCase(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[snakeKey] = value.map((item) => {
        if (item !== null && typeof item === "object") {
          return keysToSnakeCase(item as Record<string, unknown>);
        }
        return item;
      });
    } else {
      result[snakeKey] = value;
    }
  }

  return result;
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function resolveAllTokens(obj: TerraformJson): TerraformJson {
  return resolveTokens(obj, (token: Token) => tokenToString(token)) as TerraformJson;
}
