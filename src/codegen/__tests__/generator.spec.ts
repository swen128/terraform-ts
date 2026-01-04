import { test, expect, describe } from "bun:test";
import { generateProviderFiles } from "../generator.js";
import { parseProviderSchema, type ProviderSchema } from "../schema.js";
import {
  simpleProvider as rawSimple,
  multiwordProvider as rawMultiword,
  nestingModesProvider as rawNestingModes,
  computedListProvider as rawComputedList,
  computedListAttrProvider as rawComputedListAttr,
} from "./fixtures.js";

const parse = (raw: unknown): ProviderSchema => {
  const result = parseProviderSchema(raw);
  if (result.isErr()) throw new Error(result.error.message);
  return result.value;
};

const simpleProvider = parse(rawSimple);
const multiwordProvider = parse(rawMultiword);
const nestingModesProvider = parse(rawNestingModes);
const computedListProvider = parse(rawComputedList);
const computedListAttrProvider = parse(rawComputedListAttr);

const getContent = (files: ReadonlyMap<string, string>, path: string): string => {
  const content = files.get(path);
  if (content === undefined) {
    throw new Error(`File not found: ${path}`);
  }
  return content;
};

describe("file structure", () => {
  test("generates provider at provider/index.ts", () => {
    const files = generateProviderFiles("simple", simpleProvider);
    expect(files.has("provider/index.ts")).toBe(true);
  });

  test("generates resources at {name}/index.ts", () => {
    const files = generateProviderFiles("google", multiwordProvider);
    expect(files.has("alloydb-cluster/index.ts")).toBe(true);
    expect(files.has("storage-bucket/index.ts")).toBe(true);
  });

  test("generates data sources at data-{name}/index.ts", () => {
    const files = generateProviderFiles("simple", simpleProvider);
    expect(files.has("data-data/index.ts")).toBe(true);
  });

  test("generates index.ts with namespace exports", () => {
    const files = generateProviderFiles("google", multiwordProvider);
    const index = getContent(files, "index.ts");
    expect(index).toContain('export * as provider from "./provider/index.js"');
    expect(index).toContain('export * as alloydbCluster from "./alloydb-cluster/index.js"');
    expect(index).toContain('export * as storageBucket from "./storage-bucket/index.js"');
  });
});

describe("class naming", () => {
  test("provider class: {Provider}Provider", () => {
    const files = generateProviderFiles("simple", simpleProvider);
    const content = getContent(files, "provider/index.ts");
    expect(content).toContain("export class SimpleProvider extends TerraformProvider");
  });

  test("resource class: strips provider prefix, PascalCase", () => {
    const files = generateProviderFiles("google", multiwordProvider);
    const content = getContent(files, "alloydb-cluster/index.ts");
    expect(content).toContain("export class AlloydbCluster extends TerraformResource");
  });

  test("data source class: Data{Name}", () => {
    const files = generateProviderFiles("simple", simpleProvider);
    const content = getContent(files, "data-data/index.ts");
    expect(content).toContain("export class DataData extends TerraformDataSource");
  });
});

describe("type naming", () => {
  test("config type: {ClassName}Config", () => {
    const files = generateProviderFiles("test", nestingModesProvider);
    const content = getContent(files, "resource/index.ts");
    expect(content).toContain("export type ResourceConfig = {");
  });

  test("nested block type: {ClassName}{BlockName} (not {ClassName}Config{BlockName})", () => {
    const files = generateProviderFiles("test", nestingModesProvider);
    const content = getContent(files, "resource/index.ts");

    // Correct: ResourceSingleBlock
    expect(content).toContain("export type ResourceSingleBlock = {");
    expect(content).toContain("export type ResourceListBlock = {");
    expect(content).toContain("export type ResourceSingleItemList = {");
    expect(content).toContain("export type ResourceSetBlock = {");

    // Wrong: ResourceConfigSingleBlock
    expect(content).not.toContain("ResourceConfigSingleBlock");
    expect(content).not.toContain("ResourceConfigListBlock");
  });

  test("collision: append A when type name exists", () => {
    const files = generateProviderFiles("simple", simpleProvider);
    const content = getContent(files, "resource/index.ts");

    // ResourceConfig exists for the config type
    // Nested block "config" would also be ResourceConfig -> becomes ResourceConfigA
    expect(content).toContain("export type ResourceConfigA = {");
    expect(content).toContain("readonly config?: ResourceConfigA;");
  });
});

describe("property naming", () => {
  test("converts snake_case to camelCase", () => {
    const files = generateProviderFiles("test", nestingModesProvider);
    const content = getContent(files, "resource/index.ts");
    expect(content).toContain("readonly secretId?:");
    expect(content).toContain("readonly singleBlock?:");
    expect(content).toContain("readonly listBlock?:");
    expect(content).toContain("readonly singleItemList?:");
    expect(content).toContain("readonly setBlock?:");
  });

  test("uses snake_case in terraform attribute mapping", () => {
    const files = generateProviderFiles("test", nestingModesProvider);
    const content = getContent(files, "resource/index.ts");
    expect(content).toContain("secret_id: config.secretId");
    expect(content).toContain("single_block: config.singleBlock");
  });
});

describe("block nesting modes", () => {
  test("single: generates T", () => {
    const files = generateProviderFiles("test", nestingModesProvider);
    const content = getContent(files, "resource/index.ts");
    expect(content).toContain("readonly singleBlock?: ResourceSingleBlock;");
    expect(content).not.toContain("readonly singleBlock?: ResourceSingleBlock |");
  });

  test("list without max_items=1: generates readonly T[]", () => {
    const files = generateProviderFiles("test", nestingModesProvider);
    const content = getContent(files, "resource/index.ts");
    expect(content).toContain("readonly listBlock?: readonly ResourceListBlock[];");
  });

  test("set: generates readonly T[]", () => {
    const files = generateProviderFiles("test", nestingModesProvider);
    const content = getContent(files, "resource/index.ts");
    expect(content).toContain("readonly setBlock?: readonly ResourceSetBlock[];");
  });

  test("list with max_items=1: generates T (single object)", () => {
    const files = generateProviderFiles("test", nestingModesProvider);
    const content = getContent(files, "resource/index.ts");
    expect(content).toContain("readonly singleItemList?: ResourceSingleItemList;");
    expect(content).not.toContain("ResourceSingleItemList[]");
  });
});

describe("constructor body", () => {
  test("regular properties: tf_name: config.tsName", () => {
    const files = generateProviderFiles("test", nestingModesProvider);
    const content = getContent(files, "resource/index.ts");
    expect(content).toContain("secret_id: config.secretId,");
    expect(content).toContain("single_block: config.singleBlock,");
  });

  test("max_items=1 blocks: simple assignment (no array normalization)", () => {
    const files = generateProviderFiles("test", nestingModesProvider);
    const content = getContent(files, "resource/index.ts");
    expect(content).toContain("single_item_list: config.singleItemList,");
    expect(content).not.toContain("Array.isArray(config.singleItemList)");
  });
});

describe("getters", () => {
  test("generates getters for all attributes", () => {
    const files = generateProviderFiles("test", nestingModesProvider);
    const content = getContent(files, "resource/index.ts");
    expect(content).toContain("get id(): TokenValue<string> {");
    expect(content).toContain("get name(): TokenValue<string> {");
    expect(content).toContain("get secretId(): TokenValue<string> {");
    expect(content).toContain("get location(): TokenValue<string> {");
  });

  test("string getter: TokenValue<string> with getStringAttribute", () => {
    const files = generateProviderFiles("test", nestingModesProvider);
    const content = getContent(files, "resource/index.ts");
    expect(content).toContain("get secretId(): TokenValue<string> {");
    expect(content).toContain('return this.getStringAttribute("secret_id");');
  });

  test("bool getter: TokenValue<boolean> with getBooleanAttribute", () => {
    const files = generateProviderFiles("simple", simpleProvider);
    const content = getContent(files, "resource/index.ts");
    expect(content).toContain("get computedBool(): TokenValue<boolean> {");
    expect(content).toContain('return this.getBooleanAttribute("computed_bool");');
  });

  test("number getter: TokenValue<number> with getNumberAttribute", () => {
    const files = generateProviderFiles("simple", simpleProvider);
    const content = getContent(files, "resource/index.ts");
    expect(content).toContain("get computedNumber(): TokenValue<number> {");
    expect(content).toContain('return this.getNumberAttribute("computed_number");');
  });

  test("list getter: ComputedList<TokenValue<string>> with element access", () => {
    const files = generateProviderFiles("simple", simpleProvider);
    const content = getContent(files, "resource/index.ts");
    expect(content).toContain("get computedList(): ComputedList<TokenValue<string>> {");
    expect(content).toContain('return new ComputedList(this.fqn, "computed_list"');
  });
});

describe("attribute type mappings", () => {
  test("string -> TfString in config", () => {
    const files = generateProviderFiles("simple", simpleProvider);
    const content = getContent(files, "resource/index.ts");
    expect(content).toContain("readonly name: TfString;");
  });

  test("bool -> TfBoolean in config", () => {
    const files = generateProviderFiles("simple", simpleProvider);
    const content = getContent(files, "resource/index.ts");
    expect(content).toContain("readonly enabled?: TfBoolean;");
  });

  test("number -> TfNumber in config", () => {
    const files = generateProviderFiles("simple", simpleProvider);
    const content = getContent(files, "resource/index.ts");
    expect(content).toContain("readonly count?: TfNumber;");
  });

  test('["map", "string"] -> TfStringMap in config', () => {
    const files = generateProviderFiles("simple", simpleProvider);
    const content = getContent(files, "resource/index.ts");
    expect(content).toContain("readonly tags?: TfStringMap;");
  });
});

describe("optionality", () => {
  test("required: true -> required property", () => {
    const files = generateProviderFiles("simple", simpleProvider);
    const content = getContent(files, "resource/index.ts");
    expect(content).toContain("readonly name: TfString;"); // no ?
  });

  test("optional: true -> optional property", () => {
    const files = generateProviderFiles("simple", simpleProvider);
    const content = getContent(files, "resource/index.ts");
    expect(content).toContain("readonly enabled?: TfBoolean;");
  });

  test("computed: true -> optional property", () => {
    const files = generateProviderFiles("simple", simpleProvider);
    const content = getContent(files, "resource/index.ts");
    expect(content).toContain("readonly id?: TfString;");
  });

  test("block with min_items undefined or 0 -> optional", () => {
    const files = generateProviderFiles("test", nestingModesProvider);
    const content = getContent(files, "resource/index.ts");
    expect(content).toContain("readonly singleBlock?:");
    expect(content).toContain("readonly listBlock?:");
  });

  test("block with min_items >= 1 -> required", () => {
    const files = generateProviderFiles("simple", simpleProvider);
    const content = getContent(files, "resource/index.ts");
    // items has min_items: 1
    expect(content).toContain("readonly items: readonly ResourceItems[];");
  });
});

describe("input getters", () => {
  test("generates *Input getters for non-computed attributes", () => {
    const files = generateProviderFiles("simple", simpleProvider);
    const content = getContent(files, "resource/index.ts");
    // Should have nameInput for required attribute
    expect(content).toContain("get nameInput():");
    // Should have enabledInput for optional attribute
    expect(content).toContain("get enabledInput():");
    // Should have countInput for optional number attribute
    expect(content).toContain("get countInput():");
    // Should have tagsInput for optional map attribute
    expect(content).toContain("get tagsInput():");
  });

  test("does not generate *Input getters for computed-only attributes", () => {
    const files = generateProviderFiles("simple", simpleProvider);
    const content = getContent(files, "resource/index.ts");
    // id is computed-only, should not have idInput
    expect(content).not.toContain("get idInput():");
  });

  test("*Input getter returns the config value type", () => {
    const files = generateProviderFiles("simple", simpleProvider);
    const content = getContent(files, "resource/index.ts");
    expect(content).toContain("get nameInput(): TfString | undefined {");
    expect(content).toContain("return this._config.name;");
  });
});

describe("importFrom instance method", () => {
  test("generates importFrom instance method on resources", () => {
    const files = generateProviderFiles("simple", simpleProvider);
    const content = getContent(files, "resource/index.ts");
    expect(content).toContain("importFrom(resourceId: TfString): this {");
  });

  test("importFrom sets lifecycle importId and returns this", () => {
    const files = generateProviderFiles("simple", simpleProvider);
    const content = getContent(files, "resource/index.ts");
    expect(content).toContain("this.lifecycle = { ...this.lifecycle, importId: resourceId };");
    expect(content).toContain("return this;");
  });
});

describe("imports", () => {
  test("imports TokenValue instead of TokenString", () => {
    const files = generateProviderFiles("simple", simpleProvider);
    const content = getContent(files, "resource/index.ts");
    expect(content).toContain("TokenValue");
    expect(content).not.toContain("TokenString");
  });

  test("does not duplicate base class in type and value imports", () => {
    const files = generateProviderFiles("simple", simpleProvider);
    const content = getContent(files, "resource/index.ts");
    // Should have value import with TerraformResource, not in type import
    expect(content).toMatch(/import \{[^}]*\bTerraformResource\b[^}]*\} from "tfts"/);
    expect(content).not.toMatch(/import type \{[^}]*\bTerraformResource\b[^}]*\}/);
  });

  test("getter returns TokenValue<string>", () => {
    const files = generateProviderFiles("simple", simpleProvider);
    const content = getContent(files, "resource/index.ts");
    expect(content).toContain("get name(): TokenValue<string>");
  });
});

describe("provider config", () => {
  test("includes provider-specific attributes in config type", () => {
    const files = generateProviderFiles("simple", simpleProvider);
    const content = getContent(files, "provider/index.ts");
    expect(content).toContain("readonly apiKey: TfString");
    expect(content).toContain("readonly region?: TfString");
  });
});

describe("computed list block_types", () => {
  test("generates getter returning ComputedList for computed list blocks", () => {
    const files = generateProviderFiles("google", computedListProvider);
    const content = getContent(files, "cloud-run-service/index.ts");
    expect(content).toContain("get status(): ComputedList<CloudRunServiceStatusOutput>");
  });

  test("generates output class with getters for computed attributes", () => {
    const files = generateProviderFiles("google", computedListProvider);
    const content = getContent(files, "cloud-run-service/index.ts");
    expect(content).toContain("class CloudRunServiceStatusOutput extends ComputedObject");
    expect(content).toContain("get url(): TokenValue<string>");
    expect(content).toContain("get latestReadyRevisionName(): TokenValue<string>");
  });

  test("imports ComputedList and ComputedObject when needed", () => {
    const files = generateProviderFiles("google", computedListProvider);
    const content = getContent(files, "cloud-run-service/index.ts");
    expect(content).toContain("import { ComputedList, ComputedObject, TerraformResource } from");
  });
});

describe("computed list/object attributes", () => {
  test("generates getter returning ComputedList for computed list attributes", () => {
    const files = generateProviderFiles("google", computedListAttrProvider);
    const content = getContent(files, "cloud-run-service/index.ts");
    expect(content).toContain("get status(): ComputedList<CloudRunServiceStatusOutput>");
  });

  test("generates output class for computed list attribute", () => {
    const files = generateProviderFiles("google", computedListAttrProvider);
    const content = getContent(files, "cloud-run-service/index.ts");
    expect(content).toContain("class CloudRunServiceStatusOutput extends ComputedObject");
    expect(content).toContain("get url(): TokenValue<string>");
    expect(content).toContain("get latestReadyRevisionName(): TokenValue<string>");
  });

  test("does not include computed list attribute in config type", () => {
    const files = generateProviderFiles("google", computedListAttrProvider);
    const content = getContent(files, "cloud-run-service/index.ts");
    expect(content).not.toContain("readonly status?:");
    expect(content).not.toContain("readonly status:");
  });

  test("does not generate duplicate getter for computed list attribute", () => {
    const files = generateProviderFiles("google", computedListAttrProvider);
    const content = getContent(files, "cloud-run-service/index.ts");
    const matches = content.match(/get status\(\)/g);
    expect(matches?.length).toBe(1);
  });

  test("does not include computed list attribute in constructor body", () => {
    const files = generateProviderFiles("google", computedListAttrProvider);
    const content = getContent(files, "cloud-run-service/index.ts");
    expect(content).not.toContain("status: config.status");
  });

  test("imports ComputedList and ComputedObject for computed list attributes", () => {
    const files = generateProviderFiles("google", computedListAttrProvider);
    const content = getContent(files, "cloud-run-service/index.ts");
    expect(content).toContain("import { ComputedList, ComputedObject, TerraformResource }");
  });
});
