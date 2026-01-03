import type { ConstructNode, ConstructMetadata } from "./construct.js";
import type { ValidationError, ValidationErrorCode } from "./errors.js";
import type { LifecycleDef } from "./resource.js";
import { RefToken, Token } from "./tokens.js";
import type { ValidationDef } from "./variable.js";

const createError = (
  path: readonly string[],
  message: string,
  code: ValidationErrorCode,
): ValidationError => ({ path, message, code });

const collectDependsOnRefs = (metadata: ConstructMetadata): readonly string[] => {
  const deps = ((): readonly Token[] => {
    switch (metadata.kind) {
      case "resource":
        return metadata.resource.dependsOn ?? [];
      case "datasource":
        return metadata.datasource.dependsOn ?? [];
      case "output":
        return metadata.output.dependsOn ?? [];
      case "app":
      case "stack":
      case "provider":
      case "variable":
      case "backend":
      case "local":
        return [];
    }
  })();

  return deps.flatMap((d) => (d instanceof RefToken ? [d.fqn] : []));
};

const buildDependencyGraph = (
  tree: ConstructNode,
): Map<string, { readonly node: ConstructNode; readonly dependsOn: readonly string[] }> => {
  const graph = new Map<
    string,
    { readonly node: ConstructNode; readonly dependsOn: readonly string[] }
  >();

  const traverse = (node: ConstructNode): void => {
    const pathKey = node.path.join(".");
    const dependsOn = collectDependsOnRefs(node.metadata);
    graph.set(pathKey, { node, dependsOn });

    for (const child of node.children) {
      traverse(child);
    }
  };

  traverse(tree);
  return graph;
};

const findCyclesFromNode = (
  startKey: string,
  graph: Map<string, { readonly node: ConstructNode; readonly dependsOn: readonly string[] }>,
  visited: Set<string>,
  currentPath: string[],
): readonly string[][] => {
  if (currentPath.includes(startKey)) {
    const cycleStart = currentPath.indexOf(startKey);
    return [[...currentPath.slice(cycleStart), startKey]];
  }

  if (visited.has(startKey)) {
    return [];
  }

  const entry = graph.get(startKey);
  if (entry === undefined) {
    return [];
  }

  const cycles: string[][] = [];
  currentPath.push(startKey);

  for (const dep of entry.dependsOn) {
    const foundCycles = findCyclesFromNode(dep, graph, visited, currentPath);
    cycles.push(...foundCycles);
  }

  currentPath.pop();
  visited.add(startKey);

  return cycles;
};

export const detectCircularDependencies = (tree: ConstructNode): readonly string[][] | null => {
  const graph = buildDependencyGraph(tree);
  const allCycles: string[][] = [];
  const globalVisited = new Set<string>();

  for (const key of graph.keys()) {
    if (!globalVisited.has(key)) {
      const cycles = findCyclesFromNode(key, graph, globalVisited, []);
      allCycles.push(...cycles);
    }
  }

  return allCycles.length > 0 ? allCycles : null;
};

const validateAppMetadata = (
  node: ConstructNode,
  metadata: Extract<ConstructMetadata, { kind: "app" }>,
): readonly ValidationError[] => {
  const errors: ValidationError[] = [];

  if (metadata.outdir === "" || typeof metadata.outdir !== "string") {
    errors.push(
      createError(
        node.path,
        "App requires 'outdir' to be a non-empty string",
        "MISSING_REQUIRED_FIELD",
      ),
    );
  }

  return errors;
};

const validateStackMetadata = (
  node: ConstructNode,
  metadata: Extract<ConstructMetadata, { kind: "stack" }>,
): readonly ValidationError[] => {
  const errors: ValidationError[] = [];

  if (metadata.stackName === "" || typeof metadata.stackName !== "string") {
    errors.push(
      createError(
        node.path,
        "Stack requires 'stackName' to be a non-empty string",
        "MISSING_REQUIRED_FIELD",
      ),
    );
  }

  return errors;
};

const validateLifecycle = (
  path: readonly string[],
  lifecycle: NonNullable<LifecycleDef>,
): readonly ValidationError[] => {
  const errors: ValidationError[] = [];

  if (
    lifecycle.createBeforeDestroy !== undefined &&
    typeof lifecycle.createBeforeDestroy !== "boolean"
  ) {
    errors.push(
      createError(path, "lifecycle.createBeforeDestroy must be a boolean", "INVALID_FIELD_TYPE"),
    );
  }

  if (lifecycle.preventDestroy !== undefined && typeof lifecycle.preventDestroy !== "boolean") {
    errors.push(
      createError(path, "lifecycle.preventDestroy must be a boolean", "INVALID_FIELD_TYPE"),
    );
  }

  if (lifecycle.ignoreChanges !== undefined) {
    if (lifecycle.ignoreChanges !== "all" && !Array.isArray(lifecycle.ignoreChanges)) {
      errors.push(
        createError(
          path,
          "lifecycle.ignoreChanges must be 'all' or an array of strings",
          "INVALID_FIELD_TYPE",
        ),
      );
    } else if (Array.isArray(lifecycle.ignoreChanges)) {
      for (const item of lifecycle.ignoreChanges) {
        if (typeof item !== "string") {
          errors.push(
            createError(
              path,
              "lifecycle.ignoreChanges array must contain only strings",
              "INVALID_FIELD_TYPE",
            ),
          );
          break;
        }
      }
    }
  }

  if (lifecycle.precondition !== undefined) {
    for (const cond of lifecycle.precondition) {
      if (typeof cond.errorMessage !== "string") {
        errors.push(
          createError(
            path,
            "lifecycle.precondition.errorMessage must be a string",
            "INVALID_FIELD_TYPE",
          ),
        );
      }
    }
  }

  if (lifecycle.postcondition !== undefined) {
    for (const cond of lifecycle.postcondition) {
      if (typeof cond.errorMessage !== "string") {
        errors.push(
          createError(
            path,
            "lifecycle.postcondition.errorMessage must be a string",
            "INVALID_FIELD_TYPE",
          ),
        );
      }
    }
  }

  return errors;
};

export const validateResourceConfig = (node: ConstructNode): readonly ValidationError[] => {
  if (node.metadata.kind !== "resource") {
    return [];
  }

  const errors: ValidationError[] = [];
  const resource = node.metadata.resource;

  if (resource.terraformResourceType === "" || typeof resource.terraformResourceType !== "string") {
    errors.push(
      createError(
        node.path,
        "Resource requires 'terraformResourceType' to be a non-empty string",
        "MISSING_REQUIRED_FIELD",
      ),
    );
  }

  if (resource.provider !== undefined && typeof resource.provider !== "string") {
    errors.push(
      createError(node.path, "Resource 'provider' must be a string", "INVALID_FIELD_TYPE"),
    );
  }

  if (resource.lifecycle !== undefined) {
    errors.push(...validateLifecycle(node.path, resource.lifecycle));
  }

  if (resource.provisioners !== undefined) {
    for (const prov of resource.provisioners) {
      if (prov.type !== "local-exec" && prov.type !== "remote-exec" && prov.type !== "file") {
        errors.push(
          createError(
            node.path,
            "Provisioner type must be 'local-exec', 'remote-exec', or 'file'",
            "INVALID_FIELD_TYPE",
          ),
        );
      }
      if (prov.when !== undefined && prov.when !== "create" && prov.when !== "destroy") {
        errors.push(
          createError(
            node.path,
            "Provisioner 'when' must be 'create' or 'destroy'",
            "INVALID_FIELD_TYPE",
          ),
        );
      }
      if (
        prov.onFailure !== undefined &&
        prov.onFailure !== "continue" &&
        prov.onFailure !== "fail"
      ) {
        errors.push(
          createError(
            node.path,
            "Provisioner 'onFailure' must be 'continue' or 'fail'",
            "INVALID_FIELD_TYPE",
          ),
        );
      }
    }
  }

  return errors;
};

const validateProviderMetadata = (
  node: ConstructNode,
  metadata: Extract<ConstructMetadata, { kind: "provider" }>,
): readonly ValidationError[] => {
  const errors: ValidationError[] = [];
  const provider = metadata.provider;

  if (
    provider.terraformProviderSource === "" ||
    typeof provider.terraformProviderSource !== "string"
  ) {
    errors.push(
      createError(
        node.path,
        "Provider requires 'terraformProviderSource' to be a non-empty string",
        "MISSING_REQUIRED_FIELD",
      ),
    );
  }

  if (provider.version !== undefined && typeof provider.version !== "string") {
    errors.push(
      createError(node.path, "Provider 'version' must be a string", "INVALID_FIELD_TYPE"),
    );
  }

  if (provider.alias !== undefined && typeof provider.alias !== "string") {
    errors.push(createError(node.path, "Provider 'alias' must be a string", "INVALID_FIELD_TYPE"));
  }

  return errors;
};

const validateDatasourceMetadata = (
  node: ConstructNode,
  metadata: Extract<ConstructMetadata, { kind: "datasource" }>,
): readonly ValidationError[] => {
  const errors: ValidationError[] = [];
  const datasource = metadata.datasource;

  if (
    datasource.terraformResourceType === "" ||
    typeof datasource.terraformResourceType !== "string"
  ) {
    errors.push(
      createError(
        node.path,
        "DataSource requires 'terraformResourceType' to be a non-empty string",
        "MISSING_REQUIRED_FIELD",
      ),
    );
  }

  if (datasource.provider !== undefined && typeof datasource.provider !== "string") {
    errors.push(
      createError(node.path, "DataSource 'provider' must be a string", "INVALID_FIELD_TYPE"),
    );
  }

  return errors;
};

const validateSingleValidationDef = (
  path: readonly string[],
  v: ValidationDef,
): readonly ValidationError[] => {
  const errors: ValidationError[] = [];

  if (typeof v.errorMessage !== "string") {
    errors.push(
      createError(
        path,
        "Variable validation 'errorMessage' must be a string",
        "INVALID_FIELD_TYPE",
      ),
    );
  }

  return errors;
};

const validateVariableMetadata = (
  node: ConstructNode,
  metadata: Extract<ConstructMetadata, { kind: "variable" }>,
): readonly ValidationError[] => {
  const errors: ValidationError[] = [];
  const variable = metadata.variable;

  if (variable.type !== undefined && typeof variable.type !== "string") {
    errors.push(createError(node.path, "Variable 'type' must be a string", "INVALID_FIELD_TYPE"));
  }

  if (variable.description !== undefined && typeof variable.description !== "string") {
    errors.push(
      createError(node.path, "Variable 'description' must be a string", "INVALID_FIELD_TYPE"),
    );
  }

  if (variable.sensitive !== undefined && typeof variable.sensitive !== "boolean") {
    errors.push(
      createError(node.path, "Variable 'sensitive' must be a boolean", "INVALID_FIELD_TYPE"),
    );
  }

  if (variable.nullable !== undefined && typeof variable.nullable !== "boolean") {
    errors.push(
      createError(node.path, "Variable 'nullable' must be a boolean", "INVALID_FIELD_TYPE"),
    );
  }

  if (variable.validation !== undefined) {
    for (const v of variable.validation) {
      errors.push(...validateSingleValidationDef(node.path, v));
    }
  }

  return errors;
};

const validateOutputMetadata = (
  node: ConstructNode,
  metadata: Extract<ConstructMetadata, { kind: "output" }>,
): readonly ValidationError[] => {
  const errors: ValidationError[] = [];
  const output = metadata.output;

  if (output.value === undefined) {
    errors.push(createError(node.path, "Output requires 'value'", "MISSING_REQUIRED_FIELD"));
  }

  if (output.description !== undefined && typeof output.description !== "string") {
    errors.push(
      createError(node.path, "Output 'description' must be a string", "INVALID_FIELD_TYPE"),
    );
  }

  if (output.sensitive !== undefined && typeof output.sensitive !== "boolean") {
    errors.push(
      createError(node.path, "Output 'sensitive' must be a boolean", "INVALID_FIELD_TYPE"),
    );
  }

  return errors;
};

const validateBackendMetadata = (
  node: ConstructNode,
  metadata: Extract<ConstructMetadata, { kind: "backend" }>,
): readonly ValidationError[] => {
  const errors: ValidationError[] = [];
  const backend = metadata.backend;

  if (backend.type === "" || typeof backend.type !== "string") {
    errors.push(
      createError(
        node.path,
        "Backend requires 'type' to be a non-empty string",
        "MISSING_REQUIRED_FIELD",
      ),
    );
  }

  return errors;
};

const validateLocalMetadata = (
  node: ConstructNode,
  metadata: Extract<ConstructMetadata, { kind: "local" }>,
): readonly ValidationError[] => {
  const errors: ValidationError[] = [];
  const local = metadata.local;

  if (local.expression === undefined) {
    errors.push(createError(node.path, "Local requires 'expression'", "MISSING_REQUIRED_FIELD"));
  }

  return errors;
};

export const validateNode = (node: ConstructNode): readonly ValidationError[] => {
  const errors: ValidationError[] = [];

  if (node.id === "" || typeof node.id !== "string") {
    errors.push(
      createError(
        node.path,
        "Node requires 'id' to be a non-empty string",
        "MISSING_REQUIRED_FIELD",
      ),
    );
  }

  if (!Array.isArray(node.path)) {
    errors.push(createError([], "Node 'path' must be an array", "INVALID_FIELD_TYPE"));
  }

  switch (node.metadata.kind) {
    case "app":
      errors.push(...validateAppMetadata(node, node.metadata));
      break;
    case "stack":
      errors.push(...validateStackMetadata(node, node.metadata));
      break;
    case "resource":
      errors.push(...validateResourceConfig(node));
      break;
    case "provider":
      errors.push(...validateProviderMetadata(node, node.metadata));
      break;
    case "datasource":
      errors.push(...validateDatasourceMetadata(node, node.metadata));
      break;
    case "variable":
      errors.push(...validateVariableMetadata(node, node.metadata));
      break;
    case "output":
      errors.push(...validateOutputMetadata(node, node.metadata));
      break;
    case "backend":
      errors.push(...validateBackendMetadata(node, node.metadata));
      break;
    case "local":
      errors.push(...validateLocalMetadata(node, node.metadata));
      break;
  }

  return errors;
};

const collectDuplicateIds = (tree: ConstructNode): readonly ValidationError[] => {
  const seenIds = new Map<string, readonly string[]>();
  const errors: ValidationError[] = [];

  const traverse = (node: ConstructNode): void => {
    const pathKey = node.path.slice(0, -1).join(".");
    const idKey = `${pathKey}:${node.id}`;

    const existing = seenIds.get(idKey);
    if (existing !== undefined) {
      errors.push(
        createError(
          node.path,
          `Duplicate id '${node.id}' found at same level. First occurrence at: ${existing.join(".")}`,
          "DUPLICATE_ID",
        ),
      );
    } else {
      seenIds.set(idKey, node.path);
    }

    for (const child of node.children) {
      traverse(child);
    }
  };

  traverse(tree);
  return errors;
};

export const validateTree = (tree: ConstructNode): readonly ValidationError[] => {
  const errors: ValidationError[] = [];

  const traverse = (node: ConstructNode): void => {
    errors.push(...validateNode(node));
    for (const child of node.children) {
      traverse(child);
    }
  };

  traverse(tree);

  errors.push(...collectDuplicateIds(tree));

  const cycles = detectCircularDependencies(tree);
  if (cycles !== null) {
    for (const cycle of cycles) {
      errors.push(
        createError(
          [],
          `Circular dependency detected: ${cycle.join(" -> ")}`,
          "CIRCULAR_DEPENDENCY",
        ),
      );
    }
  }

  return errors;
};
