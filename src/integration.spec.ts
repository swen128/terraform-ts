import { describe, expect, test } from "bun:test";
import { S3Backend } from "./facade/backends/index.js";
import {
  App,
  Fn,
  Op,
  TerraformDataSource,
  TerraformLocal,
  TerraformOutput,
  TerraformProvider,
  TerraformResource,
  TerraformStack,
  TerraformVariable,
} from "./facade/index.js";
import { Testing } from "./testing/index.js";

class TestProvider extends TerraformProvider {
  constructor(scope: TerraformStack, id: string) {
    super(scope, id, {
      terraformResourceType: "test",
      terraformProviderSource: "hashicorp/test",
    });
  }

  protected override synthesizeAttributes(): Record<string, unknown> {
    return {};
  }
}

class TestResource extends TerraformResource {
  public name: string;
  public tags?: Record<string, string>;

  constructor(
    scope: TerraformStack,
    id: string,
    config: { name: string; tags?: Record<string, string> },
  ) {
    super(scope, id, {
      terraformResourceType: "test_resource",
      terraformGeneratorMetadata: {
        providerName: "test",
      },
    });
    this.name = config.name;
    this.tags = config.tags;
  }

  protected override synthesizeAttributes(): Record<string, unknown> {
    return {
      name: this.name,
      tags: this.tags,
    };
  }

  get idOutput(): string {
    return `\${test_resource.${this.friendlyUniqueId}.id}`;
  }

  get arnOutput(): string {
    return `\${test_resource.${this.friendlyUniqueId}.arn}`;
  }
}

class TestDataSource extends TerraformDataSource {
  public filter: string;

  constructor(scope: TerraformStack, id: string, config: { filter: string }) {
    super(scope, id, {
      terraformResourceType: "test_data",
      terraformGeneratorMetadata: {
        providerName: "test",
      },
    });
    this.filter = config.filter;
  }

  protected override synthesizeAttributes(): Record<string, unknown> {
    return {
      filter: this.filter,
    };
  }

  get resultOutput(): string {
    return `\${data.test_data.${this.friendlyUniqueId}.result}`;
  }
}

describe("Integration Tests", () => {
  describe("Basic Stack Synthesis", () => {
    test("synthesizes empty stack", () => {
      const app = new App({ outdir: "cdktf.out" });
      const stack = new TerraformStack(app, "test-stack");

      const synth = Testing.synth(stack);
      expect(synth).toBeDefined();
      expect(synth["//"]?.metadata).toBeDefined();
    });

    test("synthesizes stack with provider", () => {
      const app = new App({ outdir: "cdktf.out" });
      const stack = new TerraformStack(app, "test-stack");
      new TestProvider(stack, "test");

      const synth = Testing.synth(stack);
      expect(synth.provider).toBeDefined();
      expect(synth.provider?.test).toBeDefined();
    });

    test("synthesizes stack with resource", () => {
      const app = new App({ outdir: "cdktf.out" });
      const stack = new TerraformStack(app, "test-stack");
      new TestProvider(stack, "test");
      new TestResource(stack, "my-resource", { name: "example" });

      const synth = Testing.synth(stack);
      expect(synth.resource).toBeDefined();
      expect(synth.resource?.test_resource).toBeDefined();
      expect(synth.resource?.test_resource?.["my-resource"]).toBeDefined();
      expect(synth.resource?.test_resource?.["my-resource"]?.name).toBe("example");
    });

    test("synthesizes stack with data source", () => {
      const app = new App({ outdir: "cdktf.out" });
      const stack = new TerraformStack(app, "test-stack");
      new TestProvider(stack, "test");
      new TestDataSource(stack, "my-data", { filter: "example" });

      const synth = Testing.synth(stack);
      expect(synth.data).toBeDefined();
      expect(synth.data?.test_data).toBeDefined();
      expect(synth.data?.test_data?.["my-data"]?.filter).toBe("example");
    });
  });

  describe("Variables and Outputs", () => {
    test("synthesizes variables", () => {
      const app = new App({ outdir: "cdktf.out" });
      const stack = new TerraformStack(app, "test-stack");

      new TerraformVariable(stack, "my-var", {
        type: "string",
        default: "default-value",
        description: "A test variable",
      });

      const synth = Testing.synth(stack);
      expect(synth.variable).toBeDefined();
      expect(synth.variable?.["my-var"]).toBeDefined();
      expect(synth.variable?.["my-var"]?.type).toBe("string");
      expect(synth.variable?.["my-var"]?.default).toBe("default-value");
    });

    test("synthesizes outputs", () => {
      const app = new App({ outdir: "cdktf.out" });
      const stack = new TerraformStack(app, "test-stack");
      new TestProvider(stack, "test");
      const resource = new TestResource(stack, "my-resource", { name: "example" });

      new TerraformOutput(stack, "resource-id", {
        value: resource.idOutput,
      });

      const synth = Testing.synth(stack);
      expect(synth.output).toBeDefined();
      expect(synth.output?.["resource-id"]).toBeDefined();
      const outputVal = String(synth.output?.["resource-id"]?.value ?? "");
      expect(outputVal).toContain("test_resource.my-resource.id");
    });

    test("synthesizes locals", () => {
      const app = new App({ outdir: "cdktf.out" });
      const stack = new TerraformStack(app, "test-stack");

      new TerraformLocal(stack, "my-local", {
        key1: "value1",
        key2: 42,
      });

      const synth = Testing.synth(stack);
      expect(synth.locals).toBeDefined();
      expect(synth.locals?.["my-local"]).toEqual({ key1: "value1", key2: 42 });
    });
  });

  describe("Backend Configuration", () => {
    test("synthesizes S3 backend", () => {
      const app = new App({ outdir: "cdktf.out" });
      const stack = new TerraformStack(app, "test-stack");

      new S3Backend(stack, {
        bucket: "my-tf-state",
        key: "terraform.tfstate",
        region: "us-east-1",
        dynamodbTable: "terraform-locks",
        encrypt: true,
      });

      const synth = Testing.synth(stack);
      expect(synth.terraform?.backend?.s3).toBeDefined();
      expect(synth.terraform?.backend?.s3?.bucket).toBe("my-tf-state");
      expect(synth.terraform?.backend?.s3?.key).toBe("terraform.tfstate");
      expect(synth.terraform?.backend?.s3?.region).toBe("us-east-1");
      expect(synth.terraform?.backend?.s3?.dynamodb_table).toBe("terraform-locks");
      expect(synth.terraform?.backend?.s3?.encrypt).toBe(true);
    });
  });

  describe("Resource References", () => {
    test("resource can reference another resource", () => {
      const app = new App({ outdir: "cdktf.out" });
      const stack = new TerraformStack(app, "test-stack");
      new TestProvider(stack, "test");

      const resource1 = new TestResource(stack, "resource1", { name: "first" });
      new TestResource(stack, "resource2", {
        name: resource1.idOutput,
      });

      const synth = Testing.synth(stack);
      const resourceName = String(synth.resource?.test_resource?.["resource2"]?.name ?? "");
      expect(resourceName).toContain("test_resource.resource1.id");
    });

    test("output references resource", () => {
      const app = new App({ outdir: "cdktf.out" });
      const stack = new TerraformStack(app, "test-stack");
      new TestProvider(stack, "test");

      const resource = new TestResource(stack, "my-resource", { name: "example" });

      new TerraformOutput(stack, "arn", {
        value: resource.arnOutput,
        description: "The ARN of the resource",
      });

      const synth = Testing.synth(stack);
      const outputVal = String(synth.output?.arn?.value ?? "");
      expect(outputVal).toContain("test_resource.my-resource.arn");
      expect(synth.output?.arn?.description).toBe("The ARN of the resource");
    });
  });

  describe("Terraform Functions", () => {
    test("Fn.join in resource", () => {
      const app = new App({ outdir: "cdktf.out" });
      const stack = new TerraformStack(app, "test-stack");
      new TestProvider(stack, "test");

      const joinedName = Fn.join("-", ["prefix", "middle", "suffix"]);
      new TestResource(stack, "my-resource", { name: joinedName });

      const synth = Testing.synth(stack);
      const name = String(synth.resource?.test_resource?.["my-resource"]?.name ?? "");
      expect(name).toContain("join");
    });

    test("Fn.format in resource", () => {
      const app = new App({ outdir: "cdktf.out" });
      const stack = new TerraformStack(app, "test-stack");
      new TestProvider(stack, "test");

      const formattedName = Fn.format("resource-%s-%d", "test", 1);
      new TestResource(stack, "my-resource", { name: formattedName });

      const synth = Testing.synth(stack);
      const name = String(synth.resource?.test_resource?.["my-resource"]?.name ?? "");
      expect(name).toContain("format");
    });

    test("Fn.conditional in output", () => {
      const app = new App({ outdir: "cdktf.out" });
      const stack = new TerraformStack(app, "test-stack");

      const myVar = new TerraformVariable(stack, "enabled", {
        type: "bool",
        default: true,
      });

      new TerraformOutput(stack, "result", {
        value: Fn.conditional(String(myVar.value), "enabled", "disabled"),
      });

      const synth = Testing.synth(stack);
      const resultVal = String(synth.output?.result?.value ?? "");
      expect(resultVal).toContain("?");
    });
  });

  describe("Operators", () => {
    test("Op.add in local", () => {
      const app = new App({ outdir: "cdktf.out" });
      const stack = new TerraformStack(app, "test-stack");

      new TerraformLocal(stack, "sum", Op.add(1, 2));

      const synth = Testing.synth(stack);
      const sumVal = String(synth.locals?.sum ?? "");
      expect(sumVal).toContain("+");
    });

    test("Op.eq in conditional", () => {
      const app = new App({ outdir: "cdktf.out" });
      const stack = new TerraformStack(app, "test-stack");

      const myVar = new TerraformVariable(stack, "env", {
        type: "string",
        default: "prod",
      });

      new TerraformOutput(stack, "is-prod", {
        value: Fn.conditional(Op.eq(String(myVar.value), "prod"), "yes", "no"),
      });

      const synth = Testing.synth(stack);
      const outputVal = String(synth.output?.["is-prod"]?.value ?? "");
      expect(outputVal).toContain("==");
    });
  });

  describe("Complex Stack", () => {
    test("synthesizes complete infrastructure stack", () => {
      const app = new App({ outdir: "cdktf.out" });
      const stack = new TerraformStack(app, "complete-stack");

      new S3Backend(stack, {
        bucket: "my-tf-state",
        key: "complete/terraform.tfstate",
        region: "us-west-2",
      });

      new TestProvider(stack, "test");

      const envVar = new TerraformVariable(stack, "environment", {
        type: "string",
        default: "development",
        description: "The deployment environment",
      });

      new TerraformVariable(stack, "instance_count", {
        type: "number",
        default: 3,
      });

      new TerraformLocal(stack, "common_tags", {
        Environment: String(envVar.value),
        ManagedBy: "terraform",
      });

      const dataSource = new TestDataSource(stack, "existing", {
        filter: Fn.format("env:%s", String(envVar.value)),
      });

      const resource = new TestResource(stack, "main", {
        name: Fn.format("%s-resource", String(envVar.value)),
      });

      new TerraformOutput(stack, "resource_id", {
        value: resource.idOutput,
        description: "The ID of the main resource",
      });

      new TerraformOutput(stack, "data_result", {
        value: dataSource.resultOutput,
        sensitive: true,
      });

      const synth = Testing.synth(stack);

      expect(synth.terraform?.backend?.s3).toBeDefined();
      expect(synth.provider?.test).toBeDefined();
      expect(synth.variable?.environment).toBeDefined();
      expect(synth.variable?.instance_count).toBeDefined();
      expect(synth.locals?.common_tags).toBeDefined();
      expect(synth.data?.test_data?.existing).toBeDefined();
      expect(synth.resource?.test_resource?.main).toBeDefined();
      expect(synth.output?.resource_id).toBeDefined();
      expect(synth.output?.data_result?.sensitive).toBe(true);
    });
  });

  describe("Testing Utilities", () => {
    test("synthScope creates isolated scope", () => {
      const synth = Testing.synthScope((stack: TerraformStack) => {
        new TestProvider(stack, "test");
        new TestResource(stack, "resource", { name: "test" });
      });

      expect(synth.provider?.test).toBeDefined();
      expect(synth.resource?.test_resource?.resource?.name).toBe("test");
    });

    test("toHaveResource matcher", () => {
      const synth = Testing.synthScope((stack: TerraformStack) => {
        new TestProvider(stack, "test");
        new TestResource(stack, "resource", { name: "test-name" });
      });

      expect(Testing.toHaveResource(synth, "test_resource")).toBe(true);
      expect(Testing.toHaveResource(synth, "other_resource")).toBe(false);
    });

    test("toHaveResourceWithProperties matcher", () => {
      const synth = Testing.synthScope((stack: TerraformStack) => {
        new TestProvider(stack, "test");
        new TestResource(stack, "resource", { name: "specific-name" });
      });

      expect(
        Testing.toHaveResourceWithProperties(synth, "test_resource", {
          name: "specific-name",
        }),
      ).toBe(true);

      expect(
        Testing.toHaveResourceWithProperties(synth, "test_resource", {
          name: "wrong-name",
        }),
      ).toBe(false);
    });

    test("toHaveDataSource matcher", () => {
      const synth = Testing.synthScope((stack: TerraformStack) => {
        new TestProvider(stack, "test");
        new TestDataSource(stack, "data", { filter: "test" });
      });

      expect(Testing.toHaveDataSource(synth, "test_data")).toBe(true);
      expect(Testing.toHaveDataSource(synth, "other_data")).toBe(false);
    });

    test("toHaveProvider matcher", () => {
      const synth = Testing.synthScope((stack: TerraformStack) => {
        new TestProvider(stack, "test");
      });

      expect(Testing.toHaveProvider(synth, "test")).toBe(true);
      expect(Testing.toHaveProvider(synth, "aws")).toBe(false);
    });
  });
});
