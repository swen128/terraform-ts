import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateProvider, generateProviderFiles } from "../generator.js";
import { parseProviderSchema, type ProviderSchema } from "../schema.js";

const loadFixture = (name: string): ProviderSchema => {
  const path = join(import.meta.dir, "fixtures", `${name}.json`);
  const json: unknown = JSON.parse(readFileSync(path, "utf-8"));
  const result = parseProviderSchema(json);
  if (result.isErr()) {
    throw new Error(`Failed to parse fixture ${name}: ${result.error.message}`);
  }
  return result.value;
};

describe("generateProvider", () => {
  test("generates provider with resources and data sources", () => {
    const schema = loadFixture("simple-provider");
    const result = generateProvider("simple", schema);
    expect(result).toMatchSnapshot();
  });
});

describe("generateProviderFiles", () => {
  test("generates camelCase namespace names for multi-word resources", () => {
    const schema = loadFixture("multiword-provider");
    const files = generateProviderFiles("google", schema);
    const indexContent = files.get("index.ts");

    // Namespace names should be camelCase: alloydbCluster, storageBucket
    expect(indexContent).toContain("export * as alloydbCluster from");
    expect(indexContent).toContain("export * as storageBucket from");

    // Should NOT be all lowercase
    expect(indexContent).not.toContain("export * as alloydbcluster from");
    expect(indexContent).not.toContain("export * as storagebucket from");
  });
});

describe("nesting modes", () => {
  test("single nesting mode generates single object type, not array", () => {
    const schema = loadFixture("nesting-modes");
    const result = generateProvider("test", schema);

    // Single nesting mode should be single object only
    expect(result).toContain("readonly singleBlock?: ResourceConfigSingleBlock;");
    expect(result).not.toContain("readonly singleBlock?: ResourceConfigSingleBlock |");
  });
});

describe("attribute getters", () => {
  test("generates getters for ALL attributes, not just computed", () => {
    const schema = loadFixture("nesting-modes");
    const result = generateProvider("test", schema);

    // Should have getters for computed attributes
    expect(result).toContain("get id(): TokenString {");
    expect(result).toContain("get secretId(): TokenString {");
    expect(result).toContain("get location(): TokenString {");

    // Should ALSO have getter for required (non-computed) attribute
    expect(result).toContain("get name(): TokenString {");
  });
});

describe("lib directory structure", () => {
  test("generates lib/ directory for CDKTF compatibility", () => {
    const schema = loadFixture("multiword-provider");
    const files = generateProviderFiles("google", schema);

    // Should have lib/ prefix
    expect(files.has("lib/alloydb-cluster/index.ts")).toBe(true);
    expect(files.has("lib/storage-bucket/index.ts")).toBe(true);

    // Root index should export from lib/
    const indexContent = files.get("index.ts");
    expect(indexContent).toContain('from "./lib/alloydb-cluster');
  });
});

describe("list block types", () => {
  test("max_items=1 blocks accept single object or array (union type)", () => {
    const schema = loadFixture("nesting-modes");
    const result = generateProvider("test", schema);

    // max_items=1: accept single object or array
    expect(result).toContain(
      "readonly singleItemList?: ResourceConfigSingleItemList | readonly ResourceConfigSingleItemList[];",
    );

    // Regular list block: array only
    expect(result).toContain("readonly listBlock?: readonly ResourceConfigListBlock[];");

    // Set block: array only
    expect(result).toContain("readonly setBlock?: readonly ResourceConfigSetBlock[];");

    // Single nesting mode: single object
    expect(result).toContain("readonly singleBlock?: ResourceConfigSingleBlock;");
  });
});
