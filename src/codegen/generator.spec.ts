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
    expect(content).toContain("get ready(): IResolvable");

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
    expect(content).toContain("get ready(): IResolvable");

    expect(content).toContain("get status(): RunServiceStatusList");
    expect(content).not.toContain("readonly status?:");
  });

  test("generates config getters for required/optional attributes", () => {
    const schema: TerraformSchema = {
      format_version: "1.0",
      provider_schemas: {
        "registry.terraform.io/hashicorp/test": {
          provider: { block: {} },
          resource_schemas: {
            test_resource: {
              version: 0,
              block: {
                attributes: {
                  name: { type: "string", required: true },
                  description: { type: "string", optional: true },
                  count: { type: "number", optional: true },
                  enabled: { type: "bool", optional: true },
                  id: { type: "string", computed: true },
                },
              },
            },
          },
        },
      },
    };

    const result = generateProviderBindings(
      { namespace: "hashicorp", name: "test", fqn: "hashicorp/test", version: "1.0.0" },
      schema,
    );

    expect(result.isOk()).toBe(true);
    const files = result._unsafeUnwrap();

    const resourceFile = files.find(
      (f) => f.path === "providers/hashicorp/test/lib/resource/index.ts",
    );
    expect(resourceFile).toBeDefined();

    const content = resourceFile!.content;

    expect(content).toContain("get name(): string {");
    expect(content).toContain('return this.getStringAttribute("name");');

    expect(content).toContain("get description(): string {");
    expect(content).toContain('return this.getStringAttribute("description");');

    expect(content).toContain("get count(): number {");
    expect(content).toContain('return this.getNumberAttribute("count");');

    expect(content).toContain("get enabled(): IResolvable {");
    expect(content).toContain('return this.getBooleanAttribute("enabled");');

    expect(content).toContain("get id(): string {");
  });

  test("generates single OutputReference for blocks with max_items=1", () => {
    const schema: TerraformSchema = {
      format_version: "1.0",
      provider_schemas: {
        "registry.terraform.io/hashicorp/test": {
          provider: { block: {} },
          resource_schemas: {
            test_function: {
              version: 0,
              block: {
                attributes: {
                  name: { type: "string", required: true },
                },
                block_types: {
                  service_config: {
                    nesting_mode: "list",
                    max_items: 1,
                    block: {
                      attributes: {
                        service: { type: "string", computed: true },
                        uri: { type: "string", computed: true },
                      },
                    },
                  },
                  labels: {
                    nesting_mode: "list",
                    block: {
                      attributes: {
                        key: { type: "string", required: true },
                        value: { type: "string", required: true },
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

    const result = generateProviderBindings(
      { namespace: "hashicorp", name: "test", fqn: "hashicorp/test", version: "1.0.0" },
      schema,
    );

    expect(result.isOk()).toBe(true);
    const files = result._unsafeUnwrap();

    const resourceFile = files.find(
      (f) => f.path === "providers/hashicorp/test/lib/function/index.ts",
    );
    expect(resourceFile).toBeDefined();

    const content = resourceFile!.content;

    expect(content).toContain("get serviceConfig(): FunctionServiceConfigOutputReference");
    expect(content).not.toContain("FunctionServiceConfigList");

    expect(content).toContain("readonly labels?: FunctionLabels[];");

    expect(content).toContain("class FunctionLabelsOutputReference extends ComplexObject");
    expect(content).toContain("class FunctionLabelsList extends ComplexList");
  });

  test("generates toTerraform functions that filter unknown properties", () => {
    const schema: TerraformSchema = {
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
                  config: {
                    nesting_mode: "list",
                    max_items: 1,
                    block: {
                      attributes: {
                        timeout: { type: "number", optional: true },
                        enabled: { type: "bool", optional: true },
                      },
                      block_types: {
                        nested: {
                          nesting_mode: "list",
                          block: {
                            attributes: {
                              key: { type: "string", required: true },
                            },
                          },
                        },
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

    const result = generateProviderBindings(
      { namespace: "hashicorp", name: "test", fqn: "hashicorp/test", version: "1.0.0" },
      schema,
    );

    expect(result.isOk()).toBe(true);
    const files = result._unsafeUnwrap();

    const resourceFile = files.find(
      (f) => f.path === "providers/hashicorp/test/lib/service/index.ts",
    );
    expect(resourceFile).toBeDefined();

    const content = resourceFile!.content;

    expect(content).toContain("function ServiceConfigBlockToTerraform(");
    expect(content).toContain("timeout: config?.timeout,");
    expect(content).toContain("enabled: config?.enabled,");
    expect(content).toContain("nested: config?.nested?.map(ServiceConfigNestedToTerraform),");

    expect(content).toContain("function ServiceConfigNestedToTerraform(");
    expect(content).toContain("key: config?.key,");

    expect(content).toContain("config: ServiceConfigBlockToTerraform(this._config),");
  });

  test("generates config and synthesizeAttributes for empty blocks (blocks with only computed attrs)", () => {
    const schema: TerraformSchema = {
      format_version: "1.0",
      provider_schemas: {
        "registry.terraform.io/hashicorp/test": {
          provider: { block: {} },
          resource_schemas: {
            test_field: {
              version: 0,
              block: {
                attributes: {
                  name: { type: "string", required: true },
                },
                block_types: {
                  ttl_config: {
                    nesting_mode: "list",
                    max_items: 1,
                    block: {
                      attributes: {
                        state: { type: "string", computed: true },
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

    const result = generateProviderBindings(
      { namespace: "hashicorp", name: "test", fqn: "hashicorp/test", version: "1.0.0" },
      schema,
    );

    expect(result.isOk()).toBe(true);
    const files = result._unsafeUnwrap();

    const resourceFile = files.find(
      (f) => f.path === "providers/hashicorp/test/lib/field/index.ts",
    );
    expect(resourceFile).toBeDefined();

    const content = resourceFile!.content;

    expect(content).toContain("readonly ttlConfig?: FieldTtlConfigBlock;");
    expect(content).toContain("private _ttlConfig?: FieldTtlConfigBlock;");
    expect(content).toContain("this._ttlConfig = config.ttlConfig;");
    expect(content).toContain("ttl_config: FieldTtlConfigBlockToTerraform(this._ttlConfig),");
    expect(content).toContain("function FieldTtlConfigBlockToTerraform(");
  });

  test("uses prefixed field names for reserved attributes that conflict with base class", () => {
    const schema: TerraformSchema = {
      format_version: "1.0",
      provider_schemas: {
        "registry.terraform.io/hashicorp/test": {
          provider: { block: {} },
          resource_schemas: {
            test_resource: {
              version: 0,
              block: {
                attributes: {
                  name: { type: "string", required: true },
                  id: { type: "string", optional: true },
                  scope: { type: "string", optional: true },
                  path: { type: "string", optional: true },
                  config_id: { type: "string", optional: true },
                },
              },
            },
          },
        },
      },
    };

    const result = generateProviderBindings(
      { namespace: "hashicorp", name: "test", fqn: "hashicorp/test", version: "1.0.0" },
      schema,
    );

    expect(result.isOk()).toBe(true);
    const files = result._unsafeUnwrap();

    const resourceFile = files.find(
      (f) => f.path === "providers/hashicorp/test/lib/resource/index.ts",
    );
    expect(resourceFile).toBeDefined();

    const content = resourceFile!.content;

    expect(content).toContain("private _tfId?: string;");
    expect(content).toContain("private _tfScope?: string;");
    expect(content).toContain("private _tfPath?: string;");
    expect(content).toContain("private _tfConfigId?: string;");

    expect(content).not.toContain("private _id?:");
    expect(content).not.toContain("private _scope?:");
    expect(content).not.toContain("private _path?:");
    expect(content).not.toContain("private _configId?:");
  });

  test("uses prefixed field names for reserved block types that conflict with base class", () => {
    const schema: TerraformSchema = {
      format_version: "1.0",
      provider_schemas: {
        "registry.terraform.io/hashicorp/test": {
          provider: { block: {} },
          resource_schemas: {
            test_application: {
              version: 0,
              block: {
                attributes: {
                  name: { type: "string", required: true },
                },
                block_types: {
                  scope: {
                    nesting_mode: "list",
                    max_items: 1,
                    block: {
                      attributes: {
                        type: { type: "string", required: true },
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

    const result = generateProviderBindings(
      { namespace: "hashicorp", name: "test", fqn: "hashicorp/test", version: "1.0.0" },
      schema,
    );

    expect(result.isOk()).toBe(true);
    const files = result._unsafeUnwrap();

    const resourceFile = files.find(
      (f) => f.path === "providers/hashicorp/test/lib/application/index.ts",
    );
    expect(resourceFile).toBeDefined();

    const content = resourceFile!.content;

    expect(content).toContain("private _tfScope?: ApplicationScope;");
    expect(content).not.toContain("private _scope?:");
  });

  test("avoids collision when block type named 'config' matches resource config type", () => {
    const schema: TerraformSchema = {
      format_version: "1.0",
      provider_schemas: {
        "registry.terraform.io/hashicorp/test": {
          provider: { block: {} },
          resource_schemas: {
            test_api_hub_instance: {
              version: 0,
              block: {
                attributes: {
                  name: { type: "string", required: true },
                },
                block_types: {
                  config: {
                    nesting_mode: "list",
                    max_items: 1,
                    block: {
                      attributes: {
                        enabled: { type: "bool", optional: true },
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

    const result = generateProviderBindings(
      { namespace: "hashicorp", name: "test", fqn: "hashicorp/test", version: "1.0.0" },
      schema,
    );

    expect(result.isOk()).toBe(true);
    const files = result._unsafeUnwrap();

    const resourceFile = files.find(
      (f) => f.path === "providers/hashicorp/test/lib/api-hub-instance/index.ts",
    );
    expect(resourceFile).toBeDefined();

    const content = resourceFile!.content;

    expect(content).toContain("export type ApiHubInstanceConfigBlock = {");
    expect(content).toContain("export type ApiHubInstanceConfig = TerraformMetaArguments");
    expect(content).not.toMatch(/export type ApiHubInstanceConfig = \{[^T]/);
  });

  test("prefixes nested block type names with resource class name for CDKTF compatibility", () => {
    const schema: TerraformSchema = {
      format_version: "1.0",
      provider_schemas: {
        "registry.terraform.io/hashicorp/test": {
          provider: { block: {} },
          resource_schemas: {
            test_monitoring_alert_policy: {
              version: 0,
              block: {
                attributes: {
                  name: { type: "string", required: true },
                },
                block_types: {
                  conditions: {
                    nesting_mode: "list",
                    block: {
                      attributes: {
                        display_name: { type: "string", optional: true },
                      },
                      block_types: {
                        condition_threshold: {
                          nesting_mode: "list",
                          max_items: 1,
                          block: {
                            attributes: {
                              comparison: { type: "string", required: true },
                            },
                          },
                        },
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

    const result = generateProviderBindings(
      { namespace: "hashicorp", name: "test", fqn: "hashicorp/test", version: "1.0.0" },
      schema,
    );

    expect(result.isOk()).toBe(true);
    const files = result._unsafeUnwrap();

    const resourceFile = files.find(
      (f) => f.path === "providers/hashicorp/test/lib/monitoring-alert-policy/index.ts",
    );
    expect(resourceFile).toBeDefined();

    const content = resourceFile!.content;

    expect(content).toContain("export type MonitoringAlertPolicyConditions = {");
    expect(content).toContain("export type MonitoringAlertPolicyConditionsConditionThreshold = {");
    expect(content).toContain(
      "readonly conditionThreshold?: MonitoringAlertPolicyConditionsConditionThreshold;",
    );
  });

  test("generates nested block interfaces for provider", () => {
    const schema: TerraformSchema = {
      format_version: "1.0",
      provider_schemas: {
        "registry.terraform.io/hashicorp/test": {
          provider: {
            block: {
              attributes: {
                region: { type: "string", optional: true },
              },
              block_types: {
                batching: {
                  nesting_mode: "list",
                  max_items: 1,
                  block: {
                    attributes: {
                      enable_batching: { type: "bool", optional: true },
                      send_after: { type: "string", optional: true },
                    },
                  },
                },
              },
            },
          },
          resource_schemas: {},
        },
      },
    };

    const result = generateProviderBindings(
      { namespace: "hashicorp", name: "test", fqn: "hashicorp/test", version: "1.0.0" },
      schema,
    );

    expect(result.isOk()).toBe(true);
    const files = result._unsafeUnwrap();

    const providerFile = files.find(
      (f) => f.path === "providers/hashicorp/test/lib/provider/index.ts",
    );
    expect(providerFile).toBeDefined();

    const content = providerFile!.content;

    expect(content).toContain("export type Batching = {");
    expect(content).toContain("readonly enableBatching?: boolean;");
    expect(content).toContain("readonly sendAfter?: string;");
  });

  test("skips generating getters for reserved names like kind that conflict with base class", () => {
    const schema: TerraformSchema = {
      format_version: "1.0",
      provider_schemas: {
        "registry.terraform.io/hashicorp/test": {
          provider: { block: {} },
          resource_schemas: {
            test_entity: {
              version: 0,
              block: {
                attributes: {
                  name: { type: "string", required: true },
                  kind: { type: "string", computed: true },
                  node: { type: "string", computed: true },
                },
              },
            },
          },
        },
      },
    };

    const result = generateProviderBindings(
      { namespace: "hashicorp", name: "test", fqn: "hashicorp/test", version: "1.0.0" },
      schema,
    );

    expect(result.isOk()).toBe(true);
    const files = result._unsafeUnwrap();

    const resourceFile = files.find(
      (f) => f.path === "providers/hashicorp/test/lib/entity/index.ts",
    );
    expect(resourceFile).toBeDefined();

    const content = resourceFile!.content;

    expect(content).not.toContain("get kind():");
    expect(content).not.toContain("get node():");
  });
});
