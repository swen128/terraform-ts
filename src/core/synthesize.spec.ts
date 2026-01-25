import { describe, expect, test } from "bun:test";
import { generateLogicalId } from "./synthesize.js";

describe("generateLogicalId", () => {
  describe("single component paths", () => {
    test("returns empty string for empty path", () => {
      expect(generateLogicalId([])).toBe("");
    });

    test("returns sanitized ID for single component", () => {
      expect(generateLogicalId(["my-resource"])).toBe("my-resource");
    });

    test("removes spaces from ID", () => {
      expect(generateLogicalId(["Cash Register Logger"])).toBe("CashRegisterLogger");
    });

    test("removes special characters from ID", () => {
      expect(generateLogicalId(["hello@world!"])).toBe("helloworld");
    });

    test("preserves underscores and dashes", () => {
      expect(generateLogicalId(["my_resource-name"])).toBe("my_resource-name");
    });
  });

  describe("two component paths (stack + resource)", () => {
    test("returns sanitized resource ID without hash", () => {
      expect(generateLogicalId(["stack", "my-resource"])).toBe("my-resource");
    });

    test("removes spaces from resource ID", () => {
      expect(generateLogicalId(["stack", "Cash Register Logger"])).toBe(
        "CashRegisterLogger",
      );
    });

    test("handles IDs containing slashes as single component", () => {
      const id = "projects/my-project/secrets/my-secret/versions/1";
      expect(generateLogicalId(["stack", id])).toBe(
        "projectsmy-projectsecretsmy-secretversions1",
      );
    });
  });

  describe("multi-component paths", () => {
    test("generates unique ID with hash for nested resources", () => {
      const result = generateLogicalId(["app", "stack", "parent", "child"]);
      expect(result).toMatch(/^child_[a-f0-9]+$/);
    });

    test("sanitizes last component in unique ID", () => {
      const result = generateLogicalId(["app", "stack", "parent", "child resource"]);
      expect(result).toMatch(/^childresource_[a-f0-9]+$/);
    });

    test("different paths produce different hashes", () => {
      const result1 = generateLogicalId(["app", "stack", "parent1", "child"]);
      const result2 = generateLogicalId(["app", "stack", "parent2", "child"]);
      expect(result1).not.toBe(result2);
    });
  });
});
