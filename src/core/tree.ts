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

  return tree.children.reduce<ConstructNode | undefined>(
    (found, child) => found ?? findNode(child, path),
    undefined,
  );
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
  return [
    visitor(tree, depth),
    ...tree.children.flatMap((child) => walkTree(child, visitor, depth + 1)),
  ];
}

export function walkTreePost<T>(
  tree: ConstructNode,
  visitor: (node: ConstructNode, depth: number) => T,
  depth = 0,
): readonly T[] {
  return [
    ...tree.children.flatMap((child) => walkTreePost(child, visitor, depth + 1)),
    visitor(tree, depth),
  ];
}

export function getDescendants(
  node: ConstructNode,
  kind?: ConstructMetadata["kind"],
): readonly ConstructNode[] {
  return node.children.flatMap((child) => [
    ...(!kind || child.metadata.kind === kind ? [child] : []),
    ...getDescendants(child, kind),
  ]);
}

export function pathEquals(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((val, i) => val === b[i]);
}
