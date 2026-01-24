import { getDescendants, walkTree } from "./tree.js";
import type { ConstructNode, ValidationError } from "./types.js";

export function validateTree(tree: ConstructNode): readonly ValidationError[] {
  const errors: ValidationError[] = [];

  walkTree(tree, (node) => {
    errors.push(...validateNode(node));
  });

  const circularDeps = detectCircularDependencies(tree);
  if (circularDeps) {
    for (const cycle of circularDeps) {
      errors.push({
        path: [],
        message: `Circular dependency detected: ${cycle.join(" -> ")}`,
        level: "error",
      });
    }
  }

  return errors;
}

export function validateNode(node: ConstructNode): readonly ValidationError[] {
  const errors: ValidationError[] = [];

  switch (node.metadata.kind) {
    case "resource":
      errors.push(...validateResource(node));
      break;
    case "provider":
      errors.push(...validateProvider(node));
      break;
    case "variable":
      errors.push(...validateVariable(node));
      break;
    case "output":
      errors.push(...validateOutput(node));
      break;
    case "module":
      errors.push(...validateModule(node));
      break;
    case "stack":
      errors.push(...validateStack(node));
      break;
    case "app":
    case "datasource":
    case "backend":
    case "local":
      break;
  }

  return errors;
}

function validateResource(node: ConstructNode): readonly ValidationError[] {
  const errors: ValidationError[] = [];

  if (node.metadata.kind !== "resource") {
    return errors;
  }

  const { resource } = node.metadata;

  if (!resource.terraformResourceType) {
    errors.push({
      path: node.path,
      message: "Resource must have a terraformResourceType",
      level: "error",
    });
  }

  if (resource.count !== undefined && resource.forEach !== undefined) {
    errors.push({
      path: node.path,
      message: "Resource cannot have both count and for_each",
      level: "error",
    });
  }

  return errors;
}

function validateProvider(node: ConstructNode): readonly ValidationError[] {
  const errors: ValidationError[] = [];

  if (node.metadata.kind !== "provider") {
    return errors;
  }

  const { provider } = node.metadata;

  if (!provider.terraformProviderSource) {
    errors.push({
      path: node.path,
      message: "Provider must have a terraformProviderSource",
      level: "error",
    });
  }

  return errors;
}

function validateVariable(node: ConstructNode): readonly ValidationError[] {
  const errors: ValidationError[] = [];

  if (node.metadata.kind !== "variable") {
    return errors;
  }

  const { variable } = node.metadata;

  if (variable.validation) {
    for (const validation of variable.validation) {
      if (!validation.condition) {
        errors.push({
          path: node.path,
          message: "Variable validation must have a condition",
          level: "error",
        });
      }
      if (!validation.errorMessage) {
        errors.push({
          path: node.path,
          message: "Variable validation must have an errorMessage",
          level: "error",
        });
      }
    }
  }

  return errors;
}

function validateOutput(node: ConstructNode): readonly ValidationError[] {
  const errors: ValidationError[] = [];

  if (node.metadata.kind !== "output") {
    return errors;
  }

  const { output } = node.metadata;

  if (output.value === undefined) {
    errors.push({
      path: node.path,
      message: "Output must have a value",
      level: "error",
    });
  }

  return errors;
}

function validateModule(node: ConstructNode): readonly ValidationError[] {
  const errors: ValidationError[] = [];

  if (node.metadata.kind !== "module") {
    return errors;
  }

  const { module } = node.metadata;

  if (!module.source) {
    errors.push({
      path: node.path,
      message: "Module must have a source",
      level: "error",
    });
  }

  if (module.count !== undefined && module.forEach !== undefined) {
    errors.push({
      path: node.path,
      message: "Module cannot have both count and for_each",
      level: "error",
    });
  }

  return errors;
}

function validateStack(node: ConstructNode): readonly ValidationError[] {
  const errors: ValidationError[] = [];

  if (node.metadata.kind !== "stack") {
    return errors;
  }

  const providers = getDescendants(node, "provider");

  if (providers.length === 0) {
    errors.push({
      path: node.path,
      message: "Stack has no providers configured",
      level: "warning",
    });
  }

  return errors;
}

export function detectCircularDependencies(
  tree: ConstructNode,
): readonly (readonly string[])[] | null {
  const stacks = getDescendants(tree, "stack");

  const graph = new Map<string, readonly string[]>();

  for (const stack of stacks) {
    if (stack.metadata.kind === "stack") {
      graph.set(stack.id, stack.metadata.dependencies);
    }
  }

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inPath = new Set<string>();
  const path: string[] = [];

  function dfs(nodeId: string): boolean {
    if (inPath.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      cycles.push([...path.slice(cycleStart), nodeId]);
      return true;
    }

    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    inPath.add(nodeId);
    path.push(nodeId);

    const deps = graph.get(nodeId) ?? [];
    for (const dep of deps) {
      dfs(dep);
    }

    path.pop();
    inPath.delete(nodeId);

    return false;
  }

  for (const [nodeId] of graph) {
    dfs(nodeId);
  }

  return cycles.length > 0 ? cycles : null;
}

export function hasErrors(errors: readonly ValidationError[]): boolean {
  return errors.some((e) => e.level === "error");
}

export function formatValidationErrors(errors: readonly ValidationError[]): string {
  return errors
    .map((e) => {
      const path = e.path.length > 0 ? `[${e.path.join("/")}] ` : "";
      const level = e.level.toUpperCase();
      return `${level}: ${path}${e.message}`;
    })
    .join("\n");
}
