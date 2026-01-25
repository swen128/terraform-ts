import { describe, expect, test } from "bun:test";
import { keysToSnakeCase, camelToSnakeCase } from "./util.js";

describe("camelToSnakeCase", () => {
  test("converts camelCase to snake_case", () => {
    expect(camelToSnakeCase("dnsAuthorizations")).toBe("dns_authorizations");
  });

  test("handles multiple capitals", () => {
    expect(camelToSnakeCase("someURLValue")).toBe("some_u_r_l_value");
  });

  test("leaves snake_case unchanged", () => {
    expect(camelToSnakeCase("dns_authorizations")).toBe("dns_authorizations");
  });

  test("leaves lowercase unchanged", () => {
    expect(camelToSnakeCase("domains")).toBe("domains");
  });
});

describe("keysToSnakeCase", () => {
  test("converts top-level keys", () => {
    const input = { dnsAuthorizations: ["a", "b"], domains: ["c"] };
    const result = keysToSnakeCase(input);
    expect(result).toEqual({ dns_authorizations: ["a", "b"], domains: ["c"] });
  });

  test("converts nested object keys", () => {
    const input = {
      managed: {
        dnsAuthorizations: ["auth1"],
        issuanceConfig: "config",
      },
    };
    const result = keysToSnakeCase(input);
    expect(result).toEqual({
      managed: {
        dns_authorizations: ["auth1"],
        issuance_config: "config",
      },
    });
  });

  test("converts keys in arrays of objects", () => {
    const input = {
      items: [{ itemName: "a" }, { itemName: "b" }],
    };
    const result = keysToSnakeCase(input);
    expect(result).toEqual({
      items: [{ item_name: "a" }, { item_name: "b" }],
    });
  });

  test("preserves primitive values", () => {
    const input = { stringValue: "hello", numberValue: 42, boolValue: true };
    const result = keysToSnakeCase(input);
    expect(result).toEqual({
      string_value: "hello",
      number_value: 42,
      bool_value: true,
    });
  });

  test("handles null values", () => {
    const input = { nullValue: null };
    const result = keysToSnakeCase(input);
    expect(result).toEqual({ null_value: null });
  });

  test("removes undefined values", () => {
    const input = { definedValue: "yes", undefinedValue: undefined };
    const result = keysToSnakeCase(input);
    expect(result).toEqual({ defined_value: "yes" });
  });
});
