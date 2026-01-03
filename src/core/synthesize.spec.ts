import { describe, expect, test } from "bun:test";
import type { ConstructNode } from "./construct.js";
import type { ResourceDef } from "./resource.js";
import type { ProviderDef } from "./provider.js";
import type { DataSourceDef } from "./datasource.js";
import type { VariableDef } from "./variable.js";
import type { OutputDef } from "./output.js";
import type { BackendDef } from "./backend.js";
import type { LocalDef } from "./local.js";
import { ref, raw } from "./tokens.js";
import { generateLogicalId, generateFqn } from "./logical-id.js";
import {
  synthesizeResource,
  synthesizeProvider,
  synthesizeDataSource,
  synthesizeVariable,
  synthesizeOutput,
  synthesizeBackend,
  synthesizeLocal,
  synthesizeStack,
  collectProviders,
  collectResources,
  buildRequiredProviders,
} from "./synthesize.js";

// --- Helpers ---

const makeResourceNode = (id: string, stackId: string, resource: ResourceDef): ConstructNode => ({
  id,
  path: ["app", stackId, id],
  children: [],
  metadata: { kind: "resource", resource },
});

const makeProviderNode = (id: string, stackId: string, provider: ProviderDef): ConstructNode => ({
  id,
  path: ["app", stackId, id],
  children: [],
  metadata: { kind: "provider", provider },
});

const makeDataSourceNode = (
  id: string,
  stackId: string,
  datasource: DataSourceDef,
): ConstructNode => ({
  id,
  path: ["app", stackId, id],
  children: [],
  metadata: { kind: "datasource", datasource },
});

const makeVariableNode = (id: string, stackId: string, variable: VariableDef): ConstructNode => ({
  id,
  path: ["app", stackId, id],
  children: [],
  metadata: { kind: "variable", variable },
});

const makeOutputNode = (id: string, stackId: string, output: OutputDef): ConstructNode => ({
  id,
  path: ["app", stackId, id],
  children: [],
  metadata: { kind: "output", output },
});

const makeBackendNode = (id: string, stackId: string, backend: BackendDef): ConstructNode => ({
  id,
  path: ["app", stackId, id],
  children: [],
  metadata: { kind: "backend", backend },
});

const makeLocalNode = (id: string, stackId: string, local: LocalDef): ConstructNode => ({
  id,
  path: ["app", stackId, id],
  children: [],
  metadata: { kind: "local", local },
});

const makeStack = (id: string, children: readonly ConstructNode[] = []): ConstructNode => ({
  id,
  path: ["app", id],
  children,
  metadata: { kind: "stack", stackName: id },
});

// --- Tests ---

describe("generateLogicalId", () => {
  test("single component returns without hash", () => {
    expect(generateLogicalId(["app", "stack"])).toBe("stack");
  });

  test("multiple components include hash suffix", () => {
    expect(generateLogicalId(["app", "stack", "resource"])).toBe("stack_resource_B9C9345B");
  });

  test("deep paths include hash suffix", () => {
    expect(generateLogicalId(["app", "stack", "module", "resource"])).toBe(
      "stack_module_resource_6B847C65",
    );
  });

  test("preserves hyphens in components", () => {
    expect(generateLogicalId(["app", "my-stack", "my-resource"])).toBe(
      "my-stack_my-resource_F67D78E8",
    );
  });

  test("removes special characters", () => {
    expect(generateLogicalId(["app", "stack@123", "resource#456"])).toBe(
      "stack123_resource456_BEFD9908",
    );
  });

  test("filters Default components", () => {
    expect(generateLogicalId(["app", "stack", "Default", "resource"])).toBe(
      "stack_resource_B9C9345B",
    );
  });

  test("filters Resource from human part but includes in hash", () => {
    const id1 = generateLogicalId(["app", "stack", "Resource", "instance"]);
    const id2 = generateLogicalId(["app", "stack", "instance"]);
    expect(id1).toBe("stack_instance_CD6E02D6");
    expect(id2).toBe("stack_instance_EE3D0A04");
    expect(id1).not.toBe(id2);
  });

  test("same path produces same hash", () => {
    const id1 = generateLogicalId(["app", "stack", "resource"]);
    const id2 = generateLogicalId(["app", "stack", "resource"]);
    expect(id1).toBe(id2);
  });

  test("different paths produce different hashes", () => {
    const id1 = generateLogicalId(["app", "stack1", "resource"]);
    const id2 = generateLogicalId(["app", "stack2", "resource"]);
    expect(id1).not.toBe(id2);
  });

  test("empty path returns empty string", () => {
    expect(generateLogicalId(["app"])).toBe("");
  });
});

describe("generateFqn", () => {
  test("generates fully qualified name", () => {
    expect(generateFqn("aws_instance", "my_instance")).toBe("aws_instance.my_instance");
  });
});

describe("synthesizeResource", () => {
  test("synthesizes basic resource", () => {
    const resource: ResourceDef = {
      terraformResourceType: "aws_instance",
      config: { ami: "ami-123", instance_type: "t2.micro" },
    };
    const node = makeResourceNode("instance", "stack", resource);

    const result = synthesizeResource(node, resource);

    expect(result).toEqual({
      resourceType: "aws_instance",
      logicalId: "stack_instance_EE3D0A04",
      config: { ami: "ami-123", instance_type: "t2.micro" },
    });
  });

  test("synthesizes resource with provider", () => {
    const resource: ResourceDef = {
      terraformResourceType: "aws_instance",
      provider: "aws.west",
      config: {},
    };
    const node = makeResourceNode("instance", "stack", resource);

    const result = synthesizeResource(node, resource);

    expect(result.config["provider"]).toBe("aws.west");
  });

  test("synthesizes resource with dependsOn", () => {
    const resource: ResourceDef = {
      terraformResourceType: "aws_instance",
      dependsOn: [ref("aws_vpc.main", "id")],
      config: {},
    };
    const node = makeResourceNode("instance", "stack", resource);

    const result = synthesizeResource(node, resource);

    expect(result.config["depends_on"]).toEqual(["${aws_vpc.main.id}"]);
  });

  test("synthesizes resource with count", () => {
    const resource: ResourceDef = {
      terraformResourceType: "aws_instance",
      count: 3,
      config: {},
    };
    const node = makeResourceNode("instance", "stack", resource);

    const result = synthesizeResource(node, resource);

    expect(result.config["count"]).toBe(3);
  });

  test("synthesizes resource with forEach", () => {
    const resource: ResourceDef = {
      terraformResourceType: "aws_instance",
      forEach: raw("var.instances"),
      config: {},
    };
    const node = makeResourceNode("instance", "stack", resource);

    const result = synthesizeResource(node, resource);

    expect(result.config["for_each"]).toBe("var.instances");
  });

  test("synthesizes resource with lifecycle", () => {
    const resource: ResourceDef = {
      terraformResourceType: "aws_instance",
      lifecycle: {
        createBeforeDestroy: true,
        preventDestroy: false,
        ignoreChanges: ["tags"],
      },
      config: {},
    };
    const node = makeResourceNode("instance", "stack", resource);

    const result = synthesizeResource(node, resource);

    expect(result.config["lifecycle"]).toEqual({
      create_before_destroy: true,
      prevent_destroy: false,
      ignore_changes: ["tags"],
    });
  });

  test("synthesizes resource with tokens in config", () => {
    const resource: ResourceDef = {
      terraformResourceType: "aws_instance",
      config: { subnet_id: ref("aws_subnet.main", "id") },
    };
    const node = makeResourceNode("instance", "stack", resource);

    const result = synthesizeResource(node, resource);

    expect(result.config["subnet_id"]).toBe("${aws_subnet.main.id}");
  });
});

describe("synthesizeProvider", () => {
  test("synthesizes basic provider", () => {
    const provider: ProviderDef = {
      terraformProviderSource: "hashicorp/aws",
      config: { region: "us-east-1" },
    };

    const result = synthesizeProvider(provider);

    expect(result).toEqual({
      providerName: "aws",
      config: { region: "us-east-1" },
    });
  });

  test("synthesizes provider with alias", () => {
    const provider: ProviderDef = {
      terraformProviderSource: "hashicorp/aws",
      alias: "west",
      config: { region: "us-west-2" },
    };

    const result = synthesizeProvider(provider);

    expect(result.config["alias"]).toBe("west");
  });

  test("synthesizes provider with version", () => {
    const provider: ProviderDef = {
      terraformProviderSource: "hashicorp/aws",
      version: "~> 5.0",
      config: {},
    };

    const result = synthesizeProvider(provider);

    expect(result.providerName).toBe("aws");
  });
});

describe("synthesizeDataSource", () => {
  test("synthesizes basic data source", () => {
    const datasource: DataSourceDef = {
      terraformResourceType: "aws_ami",
      config: { most_recent: true },
    };
    const node = makeDataSourceNode("ami", "stack", datasource);

    const result = synthesizeDataSource(node, datasource);

    expect(result).toEqual({
      dataType: "aws_ami",
      logicalId: "stack_ami_78DDB46D",
      config: { most_recent: true },
    });
  });

  test("synthesizes data source with provider", () => {
    const datasource: DataSourceDef = {
      terraformResourceType: "aws_ami",
      provider: "aws.west",
      config: {},
    };
    const node = makeDataSourceNode("ami", "stack", datasource);

    const result = synthesizeDataSource(node, datasource);

    expect(result.config["provider"]).toBe("aws.west");
  });
});

describe("synthesizeVariable", () => {
  test("synthesizes basic variable", () => {
    const variable: VariableDef = {
      type: "string",
      description: "The region",
      default: "us-east-1",
    };
    const node = makeVariableNode("region", "stack", variable);

    const result = synthesizeVariable(node, variable);

    expect(result).toEqual({
      id: "stack_region_FA458601",
      block: {
        type: "string",
        description: "The region",
        default: "us-east-1",
      },
    });
  });

  test("synthesizes variable with validation", () => {
    const variable: VariableDef = {
      type: "number",
      validation: [
        {
          condition: raw("var.count > 0"),
          errorMessage: "Must be positive",
        },
      ],
    };
    const node = makeVariableNode("count", "stack", variable);

    const result = synthesizeVariable(node, variable);

    expect(result.block.validation).toEqual([
      {
        condition: "var.count > 0",
        error_message: "Must be positive",
      },
    ]);
  });

  test("synthesizes sensitive variable", () => {
    const variable: VariableDef = {
      type: "string",
      sensitive: true,
    };
    const node = makeVariableNode("password", "stack", variable);

    const result = synthesizeVariable(node, variable);

    expect(result.block.sensitive).toBe(true);
  });
});

describe("synthesizeOutput", () => {
  test("synthesizes basic output", () => {
    const output: OutputDef = {
      value: ref("aws_instance.main", "id"),
      description: "The instance ID",
    };
    const node = makeOutputNode("instance_id", "stack", output);

    const result = synthesizeOutput(node, output);

    expect(result).toEqual({
      id: "stack_instance_id_573F320B",
      block: {
        value: "${aws_instance.main.id}",
        description: "The instance ID",
      },
    });
  });

  test("synthesizes sensitive output", () => {
    const output: OutputDef = {
      value: "secret",
      sensitive: true,
    };
    const node = makeOutputNode("password", "stack", output);

    const result = synthesizeOutput(node, output);

    expect(result.block.sensitive).toBe(true);
  });
});

describe("synthesizeBackend", () => {
  test("synthesizes s3 backend", () => {
    const backend: BackendDef = {
      type: "s3",
      config: { bucket: "my-bucket", key: "state.tfstate", region: "us-east-1" },
    };

    const result = synthesizeBackend(backend);

    expect(result).toEqual({
      s3: { bucket: "my-bucket", key: "state.tfstate", region: "us-east-1" },
    });
  });

  test("synthesizes local backend", () => {
    const backend: BackendDef = {
      type: "local",
      config: { path: "./terraform.tfstate" },
    };

    const result = synthesizeBackend(backend);

    expect(result).toEqual({
      local: { path: "./terraform.tfstate" },
    });
  });
});

describe("synthesizeLocal", () => {
  test("synthesizes local value", () => {
    const local: LocalDef = {
      expression: { name: "test", value: 42 },
    };
    const node = makeLocalNode("config", "stack", local);

    const result = synthesizeLocal(node, local);

    expect(result).toEqual({
      id: "stack_config_B92807A7",
      value: { name: "test", value: 42 },
    });
  });

  test("synthesizes local with token", () => {
    const local: LocalDef = {
      expression: ref("var.name", "value"),
    };
    const node = makeLocalNode("name", "stack", local);

    const result = synthesizeLocal(node, local);

    expect(result.value).toBe("${var.name.value}");
  });
});

describe("collectProviders", () => {
  test("collects providers from stack", () => {
    const provider: ProviderDef = {
      terraformProviderSource: "hashicorp/aws",
      config: {},
    };
    const stack = makeStack("my-stack", [makeProviderNode("aws", "my-stack", provider)]);

    const result = collectProviders(stack);

    expect(result.length).toBe(1);
    const first = result[0];
    expect(first).toBeDefined();
    expect(first?.provider.terraformProviderSource).toBe("hashicorp/aws");
  });
});

describe("collectResources", () => {
  test("collects resources from stack", () => {
    const resource: ResourceDef = {
      terraformResourceType: "aws_instance",
      config: {},
    };
    const stack = makeStack("my-stack", [makeResourceNode("instance", "my-stack", resource)]);

    const result = collectResources(stack);

    expect(result.length).toBe(1);
    const first = result[0];
    expect(first).toBeDefined();
    expect(first?.resource.terraformResourceType).toBe("aws_instance");
  });
});

describe("buildRequiredProviders", () => {
  test("builds required providers from provider nodes", () => {
    const provider: ProviderDef = {
      terraformProviderSource: "hashicorp/aws",
      version: "~> 5.0",
      config: {},
    };
    const node = makeProviderNode("aws", "stack", provider);

    const result = buildRequiredProviders([{ node, provider }]);

    expect(result).toEqual({
      aws: {
        source: "hashicorp/aws",
        version: "~> 5.0",
      },
    });
  });

  test("deduplicates providers", () => {
    const provider1: ProviderDef = {
      terraformProviderSource: "hashicorp/aws",
      version: "~> 5.0",
      config: {},
    };
    const provider2: ProviderDef = {
      terraformProviderSource: "hashicorp/aws",
      alias: "west",
      config: {},
    };
    const node1 = makeProviderNode("aws", "stack", provider1);
    const node2 = makeProviderNode("aws-west", "stack", provider2);

    const result = buildRequiredProviders([
      { node: node1, provider: provider1 },
      { node: node2, provider: provider2 },
    ]);

    expect(Object.keys(result).length).toBe(1);
  });
});

describe("synthesizeStack", () => {
  test("synthesizes empty stack", () => {
    const stack = makeStack("empty");

    const result = synthesizeStack(stack);

    expect(result).toEqual({});
  });

  test("synthesizes stack with provider and resource", () => {
    const provider: ProviderDef = {
      terraformProviderSource: "hashicorp/aws",
      version: "~> 5.0",
      config: { region: "us-east-1" },
    };
    const resource: ResourceDef = {
      terraformResourceType: "aws_instance",
      config: { ami: "ami-123", instance_type: "t2.micro" },
    };

    const stack = makeStack("my-stack", [
      makeProviderNode("aws", "my-stack", provider),
      makeResourceNode("instance", "my-stack", resource),
    ]);

    const result = synthesizeStack(stack);

    expect(result.terraform?.required_providers).toEqual({
      aws: { source: "hashicorp/aws", version: "~> 5.0" },
    });
    expect(result.provider).toEqual({
      aws: [{ region: "us-east-1" }],
    });
    expect(result.resource).toEqual({
      aws_instance: {
        "my-stack_instance_066DA6AC": { ami: "ami-123", instance_type: "t2.micro" },
      },
    });
  });

  test("synthesizes stack with backend", () => {
    const backend: BackendDef = {
      type: "s3",
      config: { bucket: "my-bucket", key: "state.tfstate" },
    };

    const stack = makeStack("my-stack", [makeBackendNode("backend", "my-stack", backend)]);

    const result = synthesizeStack(stack);

    expect(result.terraform?.backend).toEqual({
      s3: { bucket: "my-bucket", key: "state.tfstate" },
    });
  });

  test("synthesizes stack with variables and outputs", () => {
    const variable: VariableDef = {
      type: "string",
      default: "us-east-1",
    };
    const output: OutputDef = {
      value: ref("var.region", "value"),
    };

    const stack = makeStack("my-stack", [
      makeVariableNode("region", "my-stack", variable),
      makeOutputNode("selected_region", "my-stack", output),
    ]);

    const result = synthesizeStack(stack);

    expect(result.variable).toEqual({
      "my-stack_region_1796B7A4": { type: "string", default: "us-east-1" },
    });
    expect(result.output).toEqual({
      "my-stack_selected_region_709B5E6B": { value: "${var.region.value}" },
    });
  });

  test("synthesizes stack with locals", () => {
    const local: LocalDef = {
      expression: { env: "production" },
    };

    const stack = makeStack("my-stack", [makeLocalNode("config", "my-stack", local)]);

    const result = synthesizeStack(stack);

    expect(result.locals).toEqual({
      "my-stack_config_C44C4FB5": { env: "production" },
    });
  });

  test("synthesizes stack with data sources", () => {
    const datasource: DataSourceDef = {
      terraformResourceType: "aws_ami",
      config: { most_recent: true },
    };

    const stack = makeStack("my-stack", [makeDataSourceNode("ami", "my-stack", datasource)]);

    const result = synthesizeStack(stack);

    expect(result.data).toEqual({
      aws_ami: {
        "my-stack_ami_2DA5A8C6": { most_recent: true },
      },
    });
  });
});
