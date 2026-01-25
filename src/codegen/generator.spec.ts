import { describe, expect, test } from "bun:test";
import { generateProviderBindings } from "./generator.js";
import type { TerraformSchema } from "./schema.js";

describe("generateProviderBindings", () => {
  const mockSchema: TerraformSchema = {
    format_version: "1.0",
    provider_schemas: {
      "registry.terraform.io/hashicorp/test": {
        provider: {
          block: {
            attributes: {
              region: { type: "string", optional: true },
            },
          },
        },
        resource_schemas: {
          test_instance: {
            version: 0,
            block: {
              attributes: {
                name: { type: "string", required: true },
                id: { type: "string", computed: true },
              },
            },
          },
          test_bucket_object: {
            version: 0,
            block: {
              attributes: {
                bucket: { type: "string", required: true },
                key: { type: "string", required: true },
              },
            },
          },
        },
        data_source_schemas: {
          test_instance: {
            version: 0,
            block: {
              attributes: {
                id: { type: "string", required: true },
                name: { type: "string", computed: true },
              },
            },
          },
        },
      },
    },
  };

  const constraint = {
    fqn: "hashicorp/test",
    namespace: "hashicorp",
    name: "test",
    version: undefined,
  };

  test("generates files with lib/{kebab-name}/index.ts structure", () => {
    const result = generateProviderBindings(constraint, mockSchema);

    expect(result.isOk()).toBe(true);
    const files = result._unsafeUnwrap();

    const paths = files.map((f) => f.path);
    expect(paths).toContain("providers/hashicorp/test/lib/provider/index.ts");
    expect(paths).toContain("providers/hashicorp/test/lib/instance/index.ts");
    expect(paths).toContain("providers/hashicorp/test/lib/bucket-object/index.ts");
    expect(paths).toContain("providers/hashicorp/test/lib/data-test-instance/index.ts");
  });

  test("generates namespace exports in index.ts", () => {
    const result = generateProviderBindings(constraint, mockSchema);

    expect(result.isOk()).toBe(true);
    const files = result._unsafeUnwrap();

    const indexFile = files.find((f) => f.path === "providers/hashicorp/test/index.ts");
    expect(indexFile).toBeDefined();

    const content = indexFile!.content;
    expect(content).toContain('export * from "./lib/provider/index.js"');
    expect(content).toContain('export * as instance from "./lib/instance/index.js"');
    expect(content).toContain('export * as bucketObject from "./lib/bucket-object/index.js"');
    expect(content).toContain(
      'export * as dataTestInstance from "./lib/data-test-instance/index.js"',
    );
  });

  test("imports from tfts", () => {
    const result = generateProviderBindings(constraint, mockSchema);

    expect(result.isOk()).toBe(true);
    const files = result._unsafeUnwrap();

    for (const file of files) {
      expect(file.content).not.toContain('from "cdktf"');
      if (
        file.content.includes("TerraformProvider") ||
        file.content.includes("TerraformResource")
      ) {
        expect(file.content).toContain('from "tfts"');
      }
    }
  });

  test("generates provider class correctly", () => {
    const result = generateProviderBindings(constraint, mockSchema);

    expect(result.isOk()).toBe(true);
    const files = result._unsafeUnwrap();

    const providerFile = files.find(
      (f) => f.path === "providers/hashicorp/test/lib/provider/index.ts",
    );
    expect(providerFile).toBeDefined();

    const content = providerFile!.content;
    expect(content).toContain("export class TestProvider extends TerraformProvider");
    expect(content).toContain('terraformProviderSource: "hashicorp/test"');
  });

  test("generates resource class correctly", () => {
    const result = generateProviderBindings(constraint, mockSchema);

    expect(result.isOk()).toBe(true);
    const files = result._unsafeUnwrap();

    const resourceFile = files.find(
      (f) => f.path === "providers/hashicorp/test/lib/instance/index.ts",
    );
    expect(resourceFile).toBeDefined();

    const content = resourceFile!.content;
    expect(content).toContain("export class Instance extends TerraformResource");
    expect(content).toContain('terraformResourceType: "test_instance"');
  });

  test("generates data source class with Data prefix and full resource type name", () => {
    const result = generateProviderBindings(constraint, mockSchema);

    expect(result.isOk()).toBe(true);
    const files = result._unsafeUnwrap();

    const dataFile = files.find(
      (f) => f.path === "providers/hashicorp/test/lib/data-test-instance/index.ts",
    );
    expect(dataFile).toBeDefined();

    const content = dataFile!.content;
    expect(content).toContain("export class DataTestInstance extends TerraformDataSource");
  });

  test("generates ComplexList for computed nested blocks", () => {
    const schemaWithComputedBlock: TerraformSchema = {
      format_version: "1.0",
      provider_schemas: {
        "registry.terraform.io/hashicorp/test": {
          provider: { block: {} },
          resource_schemas: {
            test_service: {
              version: 0,
              block: {
                attributes: {
                  name: { type: "string", required: true },
                },
                block_types: {
                  status: {
                    nesting_mode: "list",
                    block: {
                      attributes: {
                        url: { type: "string", computed: true },
                        ready: { type: "bool", computed: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const result = generateProviderBindings(constraint, schemaWithComputedBlock);
    expect(result.isOk()).toBe(true);
    const files = result._unsafeUnwrap();

    const serviceFile = files.find(
      (f) => f.path === "providers/hashicorp/test/lib/service/index.ts",
    );
    expect(serviceFile).toBeDefined();

    const content = serviceFile!.content;

    expect(content).toContain("class ServiceStatusList extends ComplexList");
    expect(content).toContain("get(index: number): ServiceStatusOutputReference");

    expect(content).toContain("class ServiceStatusOutputReference extends ComplexObject");
    expect(content).toContain("get url(): string");
    expect(content).toContain("get ready(): boolean");

    expect(content).toContain("get status(): ServiceStatusList");
  });

  test("generates ComplexList for computed attributes with list of objects", () => {
    const schemaWithComputedAttr: TerraformSchema = {
      format_version: "1.0",
      provider_schemas: {
        "registry.terraform.io/hashicorp/test": {
          provider: { block: {} },
          resource_schemas: {
            test_run_service: {
              version: 0,
              block: {
                attributes: {
                  name: { type: "string", required: true },
                  status: {
                    type: ["list", ["object", { url: "string", ready: "bool" }]],
                    computed: true,
                  },
                },
              },
            },
          },
        },
      },
    };

    const result = generateProviderBindings(constraint, schemaWithComputedAttr);
    expect(result.isOk()).toBe(true);
    const files = result._unsafeUnwrap();

    const serviceFile = files.find(
      (f) => f.path === "providers/hashicorp/test/lib/run-service/index.ts",
    );
    expect(serviceFile).toBeDefined();

    const content = serviceFile!.content;

    expect(content).toContain("class RunServiceStatusList extends ComplexList");
    expect(content).toContain("get(index: number): RunServiceStatusOutputReference");

    expect(content).toContain("class RunServiceStatusOutputReference extends ComplexObject");
    expect(content).toContain("get url(): string");
    expect(content).toContain("get ready(): boolean");

    expect(content).toContain("get status(): RunServiceStatusList");
    expect(content).not.toContain("readonly status?:");
  });
});
