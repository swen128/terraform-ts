import type { ConstructMetadata, ConstructNode } from "./construct.js";

export const findNode = (
  tree: ConstructNode,
  path: readonly string[],
): ConstructNode | undefined => {
  if (path.length === 0) {
    return tree;
  }

  const head = path[0];

  if (head !== tree.id) {
    return undefined;
  }

  const tail = path.slice(1);

  if (tail.length === 0) {
    return tree;
  }

  const nextId = tail[0];
  const child = tree.children.find((c) => c.id === nextId);

  if (!child) {
    return undefined;
  }

  return findNode(child, tail);
};

export const addChild = (
  tree: ConstructNode,
  parentPath: readonly string[],
  child: ConstructNode,
): ConstructNode => {
  if (parentPath.length === 0) {
    return {
      ...tree,
      children: [...tree.children, child],
    };
  }

  const head = parentPath[0];

  if (head !== tree.id) {
    return tree;
  }

  const tail = parentPath.slice(1);

  if (tail.length === 0) {
    return {
      ...tree,
      children: [...tree.children, child],
    };
  }

  const nextId = tail[0];

  return {
    ...tree,
    children: tree.children.map((c) => (c.id === nextId ? addChild(c, tail, child) : c)),
  };
};

export const walkTree = <T>(tree: ConstructNode, visitor: (node: ConstructNode) => T): T[] => {
  const result = visitor(tree);
  const childResults = tree.children.flatMap((child) => walkTree(child, visitor));
  return [result, ...childResults];
};

export const getChildren = (
  node: ConstructNode,
  kind: ConstructMetadata["kind"],
): readonly ConstructNode[] => {
  return node.children.filter((child) => child.metadata.kind === kind);
};
