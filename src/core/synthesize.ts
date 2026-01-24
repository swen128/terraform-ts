import { err, ok, type Result } from "neverthrow";
import type {
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

type SynthesizeError = { code: "NOT_STACK"; message: string };

export function synthesizeStack(stack: ConstructNode): Result<TerraformJson, SynthesizeError> {
  if (stack.metadata.kind !== "stack") {
    return err({ code: "NOT_STACK", message: "Can only synthesize stack nodes" });
  }

  const providers = getDescendants(stack, "provider");
  const resources = getDescendants(stack, "resource");
  const dataSources = getDescendants(stack, "datasource");
  const variables = getDescendants(stack, "variable");
  const outputs = getDescendants(stack, "output");
  const locals = getDescendants(stack, "local");
  const modules = getDescendants(stack, "module");
  const backends = getDescendants(stack, "backend");

  const terraformBlock = buildTerraformBlock(providers, backends);
  const providerBlock = buildProviderBlock(providers);
  const resourceBlock = buildResourceBlock(resources);
  const dataBlock = buildDataBlock(dataSources);
  const variableBlock = buildVariableBlock(variables);
  const outputBlock = buildOutputBlock(outputs);
  const localsBlock = buildLocalsBlock(locals);
  const moduleBlock = buildModuleBlock(modules);

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
    terraform: Object.keys(terraformBlock).length > 0 ? terraformBlock : undefined,
    provider: Object.keys(providerBlock).length > 0 ? providerBlock : undefined,
    resource: Object.keys(resourceBlock).length > 0 ? resourceBlock : undefined,
    data: Object.keys(dataBlock).length > 0 ? dataBlock : undefined,
    variable: Object.keys(variableBlock).length > 0 ? variableBlock : undefined,
    output: Object.keys(outputBlock).length > 0 ? outputBlock : undefined,
    locals: Object.keys(localsBlock).length > 0 ? localsBlock : undefined,
    module: Object.keys(moduleBlock).length > 0 ? moduleBlock : undefined,
  };

  return ok(resolveAllTokens(result));
}

function buildTerraformBlock(
  providers: readonly ConstructNode[],
  backends: readonly ConstructNode[],
): TerraformBlock {
  const requiredProviders = providers.reduce<Record<string, RequiredProvider>>((acc, p) => {
    if (p.metadata.kind !== "provider") return acc;
    const { terraformProviderSource, version } = p.metadata.provider;
    const [, name] = parseProviderSource(terraformProviderSource);
    if (name !== "" && acc[name] === undefined) {
      acc[name] = {
        source: terraformProviderSource,
        ...(version !== undefined && version !== "" ? { version } : {}),
      };
    }
    return acc;
  }, {});

  const backendNode = backends[0];
  const backendBlock =
    backendNode?.metadata.kind === "backend"
      ? { [backendNode.metadata.backend.type]: backendNode.metadata.backend.config }
      : undefined;

  return {
    required_providers: Object.keys(requiredProviders).length > 0 ? requiredProviders : undefined,
    backend: backendBlock,
  };
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

    const providerConfig: Record<string, unknown> = {
      ...config,
      ...(alias !== undefined && alias !== "" ? { alias } : {}),
    };

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
      ...(def.version !== undefined && def.version !== "" ? { version: def.version } : {}),
      ...(def.providers !== undefined ? { providers: def.providers } : {}),
      ...(def.dependsOn !== undefined && def.dependsOn.length > 0
        ? { depends_on: def.dependsOn }
        : {}),
      ...(def.forEach !== undefined ? { for_each: def.forEach } : {}),
      ...(def.count !== undefined ? { count: def.count } : {}),
      ...def.variables,
    };

    result[logicalId] = moduleBlock;
  }

  return result;
}

function synthesizeResource(def: ResourceDef, node: ConstructNode): Record<string, unknown> {
  return {
    ...keysToSnakeCase(def.config),
    ...(def.dependsOn !== undefined && def.dependsOn.length > 0
      ? { depends_on: def.dependsOn }
      : {}),
    ...(def.count !== undefined ? { count: def.count } : {}),
    ...(def.forEach !== undefined ? { for_each: def.forEach } : {}),
    ...(def.provider !== undefined && def.provider !== "" ? { provider: def.provider } : {}),
    ...(def.lifecycle !== undefined ? { lifecycle: synthesizeLifecycle(def.lifecycle) } : {}),
    ...(def.provisioners !== undefined && def.provisioners.length > 0
      ? {
          provisioner: def.provisioners.map((p) => ({
            [p.type]: {
              ...keysToSnakeCase(p.config),
              ...(p.when !== undefined ? { when: p.when } : {}),
              ...(p.onFailure !== undefined ? { on_failure: p.onFailure } : {}),
              ...(p.connection !== undefined ? { connection: keysToSnakeCase(p.connection) } : {}),
            },
          })),
        }
      : {}),
    ...(def.connection !== undefined ? { connection: keysToSnakeCase(def.connection) } : {}),
    ...def.overrides,
    "//": {
      metadata: {
        path: node.path.join("/"),
        uniqueId: generateLogicalId(node.path),
      },
    },
  };
}

function synthesizeDataSource(def: DataSourceDef): Record<string, unknown> {
  return {
    ...keysToSnakeCase(def.config),
    ...(def.dependsOn !== undefined && def.dependsOn.length > 0
      ? { depends_on: def.dependsOn }
      : {}),
    ...(def.count !== undefined ? { count: def.count } : {}),
    ...(def.forEach !== undefined ? { for_each: def.forEach } : {}),
    ...(def.provider !== undefined && def.provider !== "" ? { provider: def.provider } : {}),
  };
}

function synthesizeVariable(def: import("./types.js").VariableDef): VariableBlock {
  return {
    type: def.type !== undefined && def.type !== "" ? def.type : undefined,
    default: def.default,
    description:
      def.description !== undefined && def.description !== "" ? def.description : undefined,
    sensitive: def.sensitive,
    nullable: def.nullable,
    validation:
      def.validation !== undefined && def.validation.length > 0
        ? def.validation.map((v) => ({
            condition: v.condition,
            error_message: v.errorMessage,
          }))
        : undefined,
  };
}

function synthesizeOutput(def: import("./types.js").OutputDef): OutputBlock {
  return {
    value: def.value,
    description:
      def.description !== undefined && def.description !== "" ? def.description : undefined,
    sensitive: def.sensitive,
    depends_on: def.dependsOn !== undefined && def.dependsOn.length > 0 ? def.dependsOn : undefined,
    precondition:
      def.precondition !== undefined
        ? {
            condition: def.precondition.condition,
            error_message: def.precondition.errorMessage,
          }
        : undefined,
  };
}

function synthesizeLifecycle(def: import("./types.js").LifecycleDef): LifecycleBlock {
  return {
    create_before_destroy: def.createBeforeDestroy,
    prevent_destroy: def.preventDestroy,
    ignore_changes: def.ignoreChanges,
    replace_triggered_by:
      def.replaceTriggeredBy !== undefined && def.replaceTriggeredBy.length > 0
        ? def.replaceTriggeredBy
        : undefined,
    precondition:
      def.precondition !== undefined && def.precondition.length > 0
        ? def.precondition.map((c) => ({
            condition: c.condition,
            error_message: c.errorMessage,
          }))
        : undefined,
    postcondition:
      def.postcondition !== undefined && def.postcondition.length > 0
        ? def.postcondition.map((c) => ({
            condition: c.condition,
            error_message: c.errorMessage,
          }))
        : undefined,
  };
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
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [camelToSnake(key), transformValue(value)]),
  );
}

function transformValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(transformValue);
  }
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [camelToSnake(k), transformValue(v)]),
  );
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function resolveAllTokens(obj: TerraformJson): TerraformJson {
  const result = resolveTokens(obj, (token: Token) => tokenToString(token));
  if (result === null || typeof result !== "object" || Array.isArray(result)) {
    return {};
  }
  return Object.fromEntries(Object.entries(result));
}
