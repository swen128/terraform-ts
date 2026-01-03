import { describe, expect, test } from "bun:test";
import type { ConstructNode } from "./construct.js";
import { addChild, findNode, getChildren, walkTree } from "./tree.js";

const makeApp = (children: ConstructNode[] = []): ConstructNode => ({
  id: "app",
  path: ["app"],
  children,
  metadata: { kind: "app", outdir: "cdktf.out" },
});

const makeStack = (
  id: string,
  parentPath: string[],
  children: ConstructNode[] = [],
): ConstructNode => ({
  id,
  path: [...parentPath, id],
  children,
  metadata: { kind: "stack", stackName: id },
});

const makeResource = (id: string, parentPath: string[]): ConstructNode => ({
  id,
  path: [...parentPath, id],
  children: [],
  metadata: {
    kind: "resource",
    resource: { terraformResourceType: "aws_instance", config: {} },
  },
});

describe("findNode", () => {
  test("returns tree when path is empty", () => {
    const tree = makeApp();
    expect(findNode(tree, [])).toBe(tree);
  });

  test("returns tree when path matches root", () => {
    const tree = makeApp();
    expect(findNode(tree, ["app"])).toBe(tree);
  });

  test("returns undefined when path does not match root", () => {
    const tree = makeApp();
    expect(findNode(tree, ["other"])).toBeUndefined();
  });

  test("finds child node", () => {
    const stack = makeStack("my-stack", ["app"]);
    const tree = makeApp([stack]);
    expect(findNode(tree, ["app", "my-stack"])).toBe(stack);
  });

  test("finds deeply nested node", () => {
    const resource = makeResource("instance", ["app", "my-stack"]);
    const stack = makeStack("my-stack", ["app"], [resource]);
    const tree = makeApp([stack]);
    expect(findNode(tree, ["app", "my-stack", "instance"])).toBe(resource);
  });

  test("returns undefined for non-existent path", () => {
    const tree = makeApp([makeStack("my-stack", ["app"])]);
    expect(findNode(tree, ["app", "other-stack"])).toBeUndefined();
  });
});

describe("addChild", () => {
  test("adds child to root when parentPath is empty", () => {
    const tree = makeApp();
    const child = makeStack("new-stack", ["app"]);
    const result = addChild(tree, [], child);

    expect(result.children).toHaveLength(1);
    expect(result.children[0]).toBe(child);
    expect(result).not.toBe(tree);
  });

  test("adds child to root when parentPath matches root", () => {
    const tree = makeApp();
    const child = makeStack("new-stack", ["app"]);
    const result = addChild(tree, ["app"], child);

    expect(result.children).toHaveLength(1);
    expect(result.children[0]).toBe(child);
  });

  test("adds child to nested parent", () => {
    const stack = makeStack("my-stack", ["app"]);
    const tree = makeApp([stack]);
    const resource = makeResource("instance", ["app", "my-stack"]);

    const result = addChild(tree, ["app", "my-stack"], resource);

    expect(result.children[0]?.children).toHaveLength(1);
    expect(result.children[0]?.children[0]).toBe(resource);
  });

  test("returns original tree when parentPath does not match", () => {
    const tree = makeApp();
    const child = makeStack("new-stack", ["app"]);
    const result = addChild(tree, ["other"], child);

    expect(result).toBe(tree);
  });

  test("preserves immutability", () => {
    const stack = makeStack("my-stack", ["app"]);
    const tree = makeApp([stack]);
    const resource = makeResource("instance", ["app", "my-stack"]);

    const result = addChild(tree, ["app", "my-stack"], resource);

    expect(tree.children[0]?.children).toHaveLength(0);
    expect(result.children[0]?.children).toHaveLength(1);
  });
});

describe("walkTree", () => {
  test("visits single node", () => {
    const tree = makeApp();
    const ids = walkTree(tree, (node) => node.id);

    expect(ids).toEqual(["app"]);
  });

  test("visits all nodes in depth-first order", () => {
    const resource1 = makeResource("r1", ["app", "stack1"]);
    const resource2 = makeResource("r2", ["app", "stack2"]);
    const stack1 = makeStack("stack1", ["app"], [resource1]);
    const stack2 = makeStack("stack2", ["app"], [resource2]);
    const tree = makeApp([stack1, stack2]);

    const ids = walkTree(tree, (node) => node.id);

    expect(ids).toEqual(["app", "stack1", "r1", "stack2", "r2"]);
  });

  test("collects transformed values", () => {
    const resource = makeResource("instance", ["app", "my-stack"]);
    const stack = makeStack("my-stack", ["app"], [resource]);
    const tree = makeApp([stack]);

    const kinds = walkTree(tree, (node) => node.metadata.kind);

    expect(kinds).toEqual(["app", "stack", "resource"]);
  });
});

describe("getChildren", () => {
  test("returns empty array when no children match", () => {
    const tree = makeApp();
    expect(getChildren(tree, "stack")).toEqual([]);
  });

  test("returns children of matching kind", () => {
    const stack1 = makeStack("stack1", ["app"]);
    const stack2 = makeStack("stack2", ["app"]);
    const tree = makeApp([stack1, stack2]);

    const stacks = getChildren(tree, "stack");

    expect(stacks).toHaveLength(2);
    expect(stacks).toContain(stack1);
    expect(stacks).toContain(stack2);
  });

  test("filters out non-matching children", () => {
    const stack = makeStack("my-stack", ["app"]);
    const resource = makeResource("instance", ["app"]);
    const tree = makeApp([stack, resource]);

    const stacks = getChildren(tree, "stack");

    expect(stacks).toHaveLength(1);
    expect(stacks[0]).toBe(stack);
  });
});
