import { describe, expect, test } from "bun:test";
import { addChild, createNode, findNode, getDescendants, pathEquals, walkTree } from "./tree.js";
import type { ConstructNode } from "./types.js";

describe("tree", () => {
  const makeStackNode = (id: string, path: string[]): ConstructNode =>
    createNode(id, path, { kind: "stack", stackName: id, dependencies: [] });

  const makeResourceNode = (id: string, path: string[]): ConstructNode =>
    createNode(id, path, {
      kind: "resource",
      resource: {
        terraformResourceType: "aws_instance",
        config: {},
      },
    });

  describe("createNode", () => {
    test("creates node with correct properties", () => {
      const node = makeStackNode("my-stack", ["app", "my-stack"]);

      expect(node.id).toBe("my-stack");
      expect(node.path).toEqual(["app", "my-stack"]);
      expect(node.children).toEqual([]);
      expect(node.metadata.kind).toBe("stack");
    });
  });

  describe("addChild", () => {
    test("adds child to parent node", () => {
      const parent = makeStackNode("stack", ["app", "stack"]);
      const child = makeResourceNode("instance", ["app", "stack", "instance"]);

      const updated = addChild(parent, ["app", "stack"], child);

      expect(updated.children).toHaveLength(1);
      expect(updated.children[0]?.id).toBe("instance");
    });

    test("preserves immutability", () => {
      const parent = makeStackNode("stack", ["app", "stack"]);
      const child = makeResourceNode("instance", ["app", "stack", "instance"]);

      const updated = addChild(parent, ["app", "stack"], child);

      expect(parent.children).toHaveLength(0);
      expect(updated.children).toHaveLength(1);
    });
  });

  describe("findNode", () => {
    test("finds root node", () => {
      const root = makeStackNode("stack", ["stack"]);
      const found = findNode(root, ["stack"]);

      expect(found).toBe(root);
    });

    test("finds nested node", () => {
      const child = makeResourceNode("instance", ["stack", "instance"]);
      const root = { ...makeStackNode("stack", ["stack"]), children: [child] };

      const found = findNode(root, ["stack", "instance"]);

      expect(found).toBe(child);
    });

    test("returns undefined for non-existent path", () => {
      const root = makeStackNode("stack", ["stack"]);
      const found = findNode(root, ["stack", "missing"]);

      expect(found).toBeUndefined();
    });
  });

  describe("walkTree", () => {
    test("visits all nodes in pre-order", () => {
      const child1 = makeResourceNode("a", ["root", "a"]);
      const child2 = makeResourceNode("b", ["root", "b"]);
      const root: ConstructNode = {
        ...makeStackNode("root", ["root"]),
        children: [child1, child2],
      };

      const visited: string[] = [];
      walkTree(root, (node) => {
        visited.push(node.id);
        return node.id;
      });

      expect(visited).toEqual(["root", "a", "b"]);
    });
  });

  describe("getDescendants", () => {
    test("returns all descendants", () => {
      const child1 = makeResourceNode("a", ["root", "a"]);
      const child2 = makeResourceNode("b", ["root", "b"]);
      const root: ConstructNode = {
        ...makeStackNode("root", ["root"]),
        children: [child1, child2],
      };

      const descendants = getDescendants(root);

      expect(descendants).toHaveLength(2);
    });

    test("filters by kind", () => {
      const resource = makeResourceNode("res", ["root", "res"]);
      const provider = createNode("prov", ["root", "prov"], {
        kind: "provider",
        provider: { terraformProviderSource: "aws", config: {} },
      });
      const root: ConstructNode = {
        ...makeStackNode("root", ["root"]),
        children: [resource, provider],
      };

      const resources = getDescendants(root, "resource");
      const providers = getDescendants(root, "provider");

      expect(resources).toHaveLength(1);
      expect(providers).toHaveLength(1);
    });
  });

  describe("pathEquals", () => {
    test("returns true for equal paths", () => {
      expect(pathEquals(["a", "b"], ["a", "b"])).toBe(true);
    });

    test("returns false for different paths", () => {
      expect(pathEquals(["a", "b"], ["a", "c"])).toBe(false);
    });

    test("returns false for different lengths", () => {
      expect(pathEquals(["a"], ["a", "b"])).toBe(false);
    });
  });
});
