import type { ConstructNode, ConstructMetadata } from "./construct.js";
import type { ValidationError, ValidationErrorCode } from "./errors.js";
import { RefToken, Token } from "./tokens.js";

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
): readonly ValidationError[] =>
  metadata.outdir === ""
    ? [
        createError(
          node.path,
          "App requires 'outdir' to be a non-empty string",
          "MISSING_REQUIRED_FIELD",
        ),
      ]
    : [];

const validateStackMetadata = (
  node: ConstructNode,
  metadata: Extract<ConstructMetadata, { kind: "stack" }>,
): readonly ValidationError[] =>
  metadata.stackName === ""
    ? [
        createError(
          node.path,
          "Stack requires 'stackName' to be a non-empty string",
          "MISSING_REQUIRED_FIELD",
        ),
      ]
    : [];

export const validateResourceConfig = (node: ConstructNode): readonly ValidationError[] => {
  if (node.metadata.kind !== "resource") {
    return [];
  }

  return node.metadata.resource.terraformResourceType === ""
    ? [
        createError(
          node.path,
          "Resource requires 'terraformResourceType' to be a non-empty string",
          "MISSING_REQUIRED_FIELD",
        ),
      ]
    : [];
};

const validateProviderMetadata = (
  node: ConstructNode,
  metadata: Extract<ConstructMetadata, { kind: "provider" }>,
): readonly ValidationError[] =>
  metadata.provider.terraformProviderSource === ""
    ? [
        createError(
          node.path,
          "Provider requires 'terraformProviderSource' to be a non-empty string",
          "MISSING_REQUIRED_FIELD",
        ),
      ]
    : [];

const validateDatasourceMetadata = (
  node: ConstructNode,
  metadata: Extract<ConstructMetadata, { kind: "datasource" }>,
): readonly ValidationError[] =>
  metadata.datasource.terraformResourceType === ""
    ? [
        createError(
          node.path,
          "DataSource requires 'terraformResourceType' to be a non-empty string",
          "MISSING_REQUIRED_FIELD",
        ),
      ]
    : [];

const validateOutputMetadata = (
  node: ConstructNode,
  metadata: Extract<ConstructMetadata, { kind: "output" }>,
): readonly ValidationError[] =>
  metadata.output.value === undefined
    ? [createError(node.path, "Output requires 'value'", "MISSING_REQUIRED_FIELD")]
    : [];

const validateBackendMetadata = (
  node: ConstructNode,
  metadata: Extract<ConstructMetadata, { kind: "backend" }>,
): readonly ValidationError[] =>
  metadata.backend.type === ""
    ? [
        createError(
          node.path,
          "Backend requires 'type' to be a non-empty string",
          "MISSING_REQUIRED_FIELD",
        ),
      ]
    : [];

const validateLocalMetadata = (
  node: ConstructNode,
  metadata: Extract<ConstructMetadata, { kind: "local" }>,
): readonly ValidationError[] =>
  metadata.local.expression === undefined
    ? [createError(node.path, "Local requires 'expression'", "MISSING_REQUIRED_FIELD")]
    : [];

export const validateNode = (node: ConstructNode): readonly ValidationError[] => {
  const errors: ValidationError[] = [];

  if (node.id === "") {
    errors.push(
      createError(
        node.path,
        "Node requires 'id' to be a non-empty string",
        "MISSING_REQUIRED_FIELD",
      ),
    );
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
