import type { ConstructMetadata, ConstructNode } from "./types.js";

export function createNode(
  id: string,
  path: readonly string[],
  metadata: ConstructMetadata,
): ConstructNode {
  return {
    id,
    path,
    children: [],
    metadata,
  };
}

export function addChild(
  tree: ConstructNode,
  parentPath: readonly string[],
  child: ConstructNode,
): ConstructNode {
  if (pathEquals(tree.path, parentPath)) {
    return {
      ...tree,
      children: [...tree.children, child],
    };
  }

  return {
    ...tree,
    children: tree.children.map((c) => addChild(c, parentPath, child)),
  };
}

export function findNode(tree: ConstructNode, path: readonly string[]): ConstructNode | undefined {
  if (pathEquals(tree.path, path)) {
    return tree;
  }

  for (const child of tree.children) {
    const found = findNode(child, path);
    if (found) {
      return found;
    }
  }

  return undefined;
}

export function updateNode(
  tree: ConstructNode,
  path: readonly string[],
  updater: (node: ConstructNode) => ConstructNode,
): ConstructNode {
  if (pathEquals(tree.path, path)) {
    return updater(tree);
  }

  return {
    ...tree,
    children: tree.children.map((c) => updateNode(c, path, updater)),
  };
}

export function removeNode(tree: ConstructNode, path: readonly string[]): ConstructNode {
  if (pathEquals(tree.path, path)) {
    return tree;
  }

  return {
    ...tree,
    children: tree.children
      .filter((c) => !pathEquals(c.path, path))
      .map((c) => removeNode(c, path)),
  };
}

export function walkTree<T>(
  tree: ConstructNode,
  visitor: (node: ConstructNode, depth: number) => T,
  depth = 0,
): readonly T[] {
  const result: T[] = [visitor(tree, depth)];

  for (const child of tree.children) {
    result.push(...walkTree(child, visitor, depth + 1));
  }

  return result;
}

export function walkTreePost<T>(
  tree: ConstructNode,
  visitor: (node: ConstructNode, depth: number) => T,
  depth = 0,
): readonly T[] {
  const result: T[] = [];

  for (const child of tree.children) {
    result.push(...walkTreePost(child, visitor, depth + 1));
  }

  result.push(visitor(tree, depth));
  return result;
}

export function getDescendants(
  node: ConstructNode,
  kind?: ConstructMetadata["kind"],
): readonly ConstructNode[] {
  const result: ConstructNode[] = [];

  for (const child of node.children) {
    if (!kind || child.metadata.kind === kind) {
      result.push(child);
    }
    result.push(...getDescendants(child, kind));
  }

  return result;
}

export function pathEquals(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}
