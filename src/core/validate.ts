import type { ConstructNode, ConstructMetadata } from "./construct.js";
import type { ValidationError } from "./errors.js";
import { RefToken, Token } from "./tokens.js";

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
    node.children.forEach(traverse);
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

  currentPath.push(startKey);
  const cycles = entry.dependsOn.flatMap((dep) =>
    findCyclesFromNode(dep, graph, visited, currentPath),
  );
  currentPath.pop();
  visited.add(startKey);

  return cycles;
};

export const detectCircularDependencies = (tree: ConstructNode): readonly string[][] | null => {
  const graph = buildDependencyGraph(tree);
  const globalVisited = new Set<string>();

  const allCycles = [...graph.keys()]
    .filter((key) => !globalVisited.has(key))
    .flatMap((key) => findCyclesFromNode(key, graph, globalVisited, []));

  return allCycles.length > 0 ? allCycles : null;
};

const collectDuplicateIds = (tree: ConstructNode): readonly ValidationError[] => {
  const seenIds = new Map<string, readonly string[]>();
  const errors: ValidationError[] = [];

  const traverse = (node: ConstructNode): void => {
    const parentPath = node.path.slice(0, -1).join(".");
    const idKey = `${parentPath}:${node.id}`;

    const existing = seenIds.get(idKey);
    if (existing !== undefined) {
      errors.push({
        path: node.path,
        message: `Duplicate id '${node.id}' found at same level. First occurrence at: ${existing.join(".")}`,
        code: "DUPLICATE_ID",
      });
    } else {
      seenIds.set(idKey, node.path);
    }

    node.children.forEach(traverse);
  };

  traverse(tree);
  return errors;
};

const EMPTY_PATH: readonly string[] = [];

export const validateTree = (tree: ConstructNode): readonly ValidationError[] => {
  const errors: ValidationError[] = [...collectDuplicateIds(tree)];

  const cycles = detectCircularDependencies(tree);
  if (cycles !== null) {
    errors.push(
      ...cycles.map(
        (cycle): ValidationError => ({
          path: EMPTY_PATH,
          message: `Circular dependency detected: ${cycle.join(" -> ")}`,
          code: "CIRCULAR_DEPENDENCY",
        }),
      ),
    );
  }

  return errors;
};
