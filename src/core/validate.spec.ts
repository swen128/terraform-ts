import { describe, expect, test } from "bun:test";
import type { ConstructNode } from "./construct.js";
import { ref } from "./tokens.js";
import { detectCircularDependencies, validateTree } from "./validate.js";

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
  dependsOn?: ReturnType<typeof ref>[],
): ConstructNode => ({
  id,
  path: ["app", stackId, id],
  children: [],
  metadata: {
    kind: "resource",
    resource: {
      terraformResourceType: "aws_instance",
      config: {},
      dependsOn,
    },
  },
});

describe("detectCircularDependencies", () => {
  test("returns null for tree without dependencies", () => {
    const tree = makeApp([makeStack("stack1", [makeResource("r1", "stack1")])]);
    expect(detectCircularDependencies(tree)).toBeNull();
  });

  test("returns null for tree with valid dependencies", () => {
    const r1 = makeResource("r1", "stack1");
    const r2 = makeResource("r2", "stack1", [ref("app.stack1.r1", "id")]);
    const tree = makeApp([makeStack("stack1", [r1, r2])]);
    expect(detectCircularDependencies(tree)).toBeNull();
  });

  test("detects simple circular dependency", () => {
    const r1 = makeResource("r1", "stack1", [ref("app.stack1.r2", "id")]);
    const r2 = makeResource("r2", "stack1", [ref("app.stack1.r1", "id")]);
    const tree = makeApp([makeStack("stack1", [r1, r2])]);
    const cycles = detectCircularDependencies(tree);

    expect(cycles).not.toBeNull();
    expect(cycles?.length).toBeGreaterThan(0);
  });
});

describe("validateTree", () => {
  test("returns empty for valid tree", () => {
    const tree = makeApp([makeStack("my-stack", [makeResource("instance", "my-stack")])]);
    expect(validateTree(tree)).toEqual([]);
  });

  test("detects duplicate ids at same level", () => {
    const r1 = makeResource("instance", "stack1");
    const r2 = makeResource("instance", "stack1");
    const tree = makeApp([makeStack("stack1", [r1, r2])]);
    const errors = validateTree(tree);

    expect(errors.some((e) => e.code === "DUPLICATE_ID")).toBe(true);
  });

  test("includes circular dependency errors", () => {
    const r1 = makeResource("r1", "stack1", [ref("app.stack1.r2", "id")]);
    const r2 = makeResource("r2", "stack1", [ref("app.stack1.r1", "id")]);
    const tree = makeApp([makeStack("stack1", [r1, r2])]);
    const errors = validateTree(tree);

    expect(errors.some((e) => e.code === "CIRCULAR_DEPENDENCY")).toBe(true);
  });
});
