import { describe, expect, test } from "bun:test";
import type { ConstructNode } from "./construct.js";
import { ref } from "./tokens.js";
import {
  detectCircularDependencies,
  validateNode,
  validateResourceConfig,
  validateTree,
} from "./validate.js";

const makeApp = (children: ConstructNode[] = []): ConstructNode => ({
  id: "app",
  path: ["app"],
  children,
  metadata: { kind: "app", outdir: "cdktf.out" },
});

const makeStack = (id: string, children: ConstructNode[] = []): ConstructNode => ({
  id,
  path: ["app", id],
  children,
  metadata: { kind: "stack", stackName: id },
});

const makeResource = (
  id: string,
  stackId: string,
  config: Partial<ConstructNode["metadata"] & { kind: "resource" }> = {},
): ConstructNode => ({
  id,
  path: ["app", stackId, id],
  children: [],
  metadata: {
    kind: "resource",
    resource: {
      terraformResourceType: "aws_instance",
      config: {},
      ...config,
    },
  },
});

describe("validateNode", () => {
  test("validates app with valid outdir", () => {
    const node = makeApp();
    expect(validateNode(node)).toEqual([]);
  });

  test("fails for app with empty outdir", () => {
    const node: ConstructNode = {
      id: "app",
      path: ["app"],
      children: [],
      metadata: { kind: "app", outdir: "" },
    };
    const errors = validateNode(node);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.code).toBe("MISSING_REQUIRED_FIELD");
  });

  test("validates stack with valid stackName", () => {
    const node = makeStack("my-stack");
    expect(validateNode(node)).toEqual([]);
  });

  test("fails for stack with empty stackName", () => {
    const node: ConstructNode = {
      id: "stack",
      path: ["app", "stack"],
      children: [],
      metadata: { kind: "stack", stackName: "" },
    };
    const errors = validateNode(node);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.code).toBe("MISSING_REQUIRED_FIELD");
  });

  test("fails for node with empty id", () => {
    const node: ConstructNode = {
      id: "",
      path: ["app"],
      children: [],
      metadata: { kind: "app", outdir: "out" },
    };
    const errors = validateNode(node);
    expect(errors.some((e) => e.message.includes("'id'"))).toBe(true);
  });
});

describe("validateResourceConfig", () => {
  test("validates valid resource", () => {
    const node = makeResource("instance", "my-stack");
    expect(validateResourceConfig(node)).toEqual([]);
  });

  test("returns empty for non-resource node", () => {
    const node = makeStack("my-stack");
    expect(validateResourceConfig(node)).toEqual([]);
  });

  test("fails for resource with empty terraformResourceType", () => {
    const node: ConstructNode = {
      id: "instance",
      path: ["app", "stack", "instance"],
      children: [],
      metadata: {
        kind: "resource",
        resource: { terraformResourceType: "", config: {} },
      },
    };
    const errors = validateResourceConfig(node);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.code).toBe("MISSING_REQUIRED_FIELD");
  });

  test("validates resource with count as number", () => {
    const node: ConstructNode = {
      id: "instance",
      path: ["app", "stack", "instance"],
      children: [],
      metadata: {
        kind: "resource",
        resource: { terraformResourceType: "aws_instance", config: {}, count: 3 },
      },
    };
    expect(validateResourceConfig(node)).toEqual([]);
  });

  test("validates resource with count as token", () => {
    const node: ConstructNode = {
      id: "instance",
      path: ["app", "stack", "instance"],
      children: [],
      metadata: {
        kind: "resource",
        resource: {
          terraformResourceType: "aws_instance",
          config: {},
          count: ref("var.count", "value"),
        },
      },
    };
    expect(validateResourceConfig(node)).toEqual([]);
  });
});

describe("detectCircularDependencies", () => {
  test("returns null for tree without dependencies", () => {
    const tree = makeApp([makeStack("stack1", [makeResource("r1", "stack1")])]);
    expect(detectCircularDependencies(tree)).toBeNull();
  });

  test("returns null for tree with valid dependencies", () => {
    const r1 = makeResource("r1", "stack1");
    const r2: ConstructNode = {
      id: "r2",
      path: ["app", "stack1", "r2"],
      children: [],
      metadata: {
        kind: "resource",
        resource: {
          terraformResourceType: "aws_instance",
          config: {},
          dependsOn: [ref("app.stack1.r1", "id")],
        },
      },
    };
    const tree = makeApp([makeStack("stack1", [r1, r2])]);
    expect(detectCircularDependencies(tree)).toBeNull();
  });

  test("detects simple circular dependency", () => {
    const r1: ConstructNode = {
      id: "r1",
      path: ["app", "stack1", "r1"],
      children: [],
      metadata: {
        kind: "resource",
        resource: {
          terraformResourceType: "aws_instance",
          config: {},
          dependsOn: [ref("app.stack1.r2", "id")],
        },
      },
    };
    const r2: ConstructNode = {
      id: "r2",
      path: ["app", "stack1", "r2"],
      children: [],
      metadata: {
        kind: "resource",
        resource: {
          terraformResourceType: "aws_instance",
          config: {},
          dependsOn: [ref("app.stack1.r1", "id")],
        },
      },
    };
    const tree = makeApp([makeStack("stack1", [r1, r2])]);
    const cycles = detectCircularDependencies(tree);

    expect(cycles).not.toBeNull();
    expect(cycles?.length).toBeGreaterThan(0);
  });
});

describe("validateTree", () => {
  test("validates valid tree", () => {
    const tree = makeApp([makeStack("my-stack", [makeResource("instance", "my-stack")])]);
    expect(validateTree(tree)).toEqual([]);
  });

  test("collects errors from all nodes", () => {
    const invalidApp: ConstructNode = {
      id: "",
      path: [""],
      children: [
        {
          id: "",
          path: ["", ""],
          children: [],
          metadata: { kind: "stack", stackName: "" },
        },
      ],
      metadata: { kind: "app", outdir: "" },
    };
    const errors = validateTree(invalidApp);
    expect(errors.length).toBeGreaterThan(1);
  });

  test("detects duplicate ids at same level", () => {
    const r1 = makeResource("instance", "stack1");
    const r2 = makeResource("instance", "stack1");
    const tree = makeApp([makeStack("stack1", [r1, r2])]);
    const errors = validateTree(tree);

    expect(errors.some((e) => e.code === "DUPLICATE_ID")).toBe(true);
  });

  test("includes circular dependency errors", () => {
    const r1: ConstructNode = {
      id: "r1",
      path: ["app", "stack1", "r1"],
      children: [],
      metadata: {
        kind: "resource",
        resource: {
          terraformResourceType: "aws_instance",
          config: {},
          dependsOn: [ref("app.stack1.r2", "id")],
        },
      },
    };
    const r2: ConstructNode = {
      id: "r2",
      path: ["app", "stack1", "r2"],
      children: [],
      metadata: {
        kind: "resource",
        resource: {
          terraformResourceType: "aws_instance",
          config: {},
          dependsOn: [ref("app.stack1.r1", "id")],
        },
      },
    };
    const tree = makeApp([makeStack("stack1", [r1, r2])]);
    const errors = validateTree(tree);

    expect(errors.some((e) => e.code === "CIRCULAR_DEPENDENCY")).toBe(true);
  });
});
