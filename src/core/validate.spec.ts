import { describe, expect, test } from "bun:test";
import { createNode } from "./tree.js";
import type { ConstructNode } from "./types.js";
import { detectCircularDependencies, hasErrors, validateNode } from "./validate.js";

describe("validate", () => {
  describe("validateNode", () => {
    test("validates resource has terraformResourceType", () => {
      const node = createNode("res", ["stack", "res"], {
        kind: "resource",
        resource: {
          terraformResourceType: "",
          config: {},
        },
      });

      const errors = validateNode(node);

      expect(errors.some((e) => e.message.includes("terraformResourceType"))).toBe(true);
    });

    test("validates resource cannot have both count and forEach", () => {
      const node = createNode("res", ["stack", "res"], {
        kind: "resource",
        resource: {
          terraformResourceType: "aws_instance",
          count: 2,
          forEach: "each.value",
          config: {},
        },
      });

      const errors = validateNode(node);

      expect(errors.some((e) => e.message.includes("count and for_each"))).toBe(true);
    });

    test("validates provider has source", () => {
      const node = createNode("prov", ["stack", "prov"], {
        kind: "provider",
        provider: {
          terraformProviderSource: "",
          config: {},
        },
      });

      const errors = validateNode(node);

      expect(errors.some((e) => e.message.includes("terraformProviderSource"))).toBe(true);
    });

    test("validates output has value", () => {
      const node = createNode("out", ["stack", "out"], {
        kind: "output",
        output: {
          value: undefined,
        },
      });

      const errors = validateNode(node);

      expect(errors.some((e) => e.message.includes("value"))).toBe(true);
    });

    test("validates module has source", () => {
      const node = createNode("mod", ["stack", "mod"], {
        kind: "module",
        module: {
          source: "",
          variables: {},
        },
      });

      const errors = validateNode(node);

      expect(errors.some((e) => e.message.includes("source"))).toBe(true);
    });
  });

  describe("detectCircularDependencies", () => {
    test("detects circular dependency", () => {
      const stackA: ConstructNode = createNode("a", ["app", "a"], {
        kind: "stack",
        stackName: "a",
        dependencies: ["b"],
      });
      const stackB: ConstructNode = createNode("b", ["app", "b"], {
        kind: "stack",
        stackName: "b",
        dependencies: ["a"],
      });
      const app: ConstructNode = {
        ...createNode("app", ["app"], {
          kind: "app",
          outdir: "out",
          skipValidation: false,
          skipBackendValidation: false,
        }),
        children: [stackA, stackB],
      };

      const cycles = detectCircularDependencies(app);

      expect(cycles).not.toBeNull();
      expect(cycles?.length).toBeGreaterThan(0);
    });

    test("returns null for no cycles", () => {
      const stackA: ConstructNode = createNode("a", ["app", "a"], {
        kind: "stack",
        stackName: "a",
        dependencies: [],
      });
      const stackB: ConstructNode = createNode("b", ["app", "b"], {
        kind: "stack",
        stackName: "b",
        dependencies: ["a"],
      });
      const app: ConstructNode = {
        ...createNode("app", ["app"], {
          kind: "app",
          outdir: "out",
          skipValidation: false,
          skipBackendValidation: false,
        }),
        children: [stackA, stackB],
      };

      const cycles = detectCircularDependencies(app);

      expect(cycles).toBeNull();
    });
  });

  describe("hasErrors", () => {
    test("returns true when errors exist", () => {
      const errors = [{ path: [], message: "error", level: "error" as const }];
      expect(hasErrors(errors)).toBe(true);
    });

    test("returns false for warnings only", () => {
      const errors = [{ path: [], message: "warn", level: "warning" as const }];
      expect(hasErrors(errors)).toBe(false);
    });

    test("returns false for empty array", () => {
      expect(hasErrors([])).toBe(false);
    });
  });
});
