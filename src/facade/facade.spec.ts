import { test, expect, describe } from "bun:test";
import { App } from "./app.js";
import { TerraformStack } from "./stack.js";
import { TerraformVariable } from "./variable.js";
import { TerraformOutput } from "./output.js";
import { TerraformLocal } from "./local.js";
import { S3Backend } from "./backends/s3.js";

describe("Facade Integration", () => {
  test("empty stack", () => {
    const app = new App();
    new TerraformStack(app, "test");

    const result = app.synth();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.get("test")).toMatchSnapshot();
    }
  });

  test("stack with variable", () => {
    const app = new App();
    const stack = new TerraformStack(app, "test");

    new TerraformVariable(stack, "region", {
      type: "string",
      default: "us-east-1",
      description: "AWS region",
    });

    const result = app.synth();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.get("test")).toMatchSnapshot();
    }
  });

  test("stack with output referencing variable", () => {
    const app = new App();
    const stack = new TerraformStack(app, "test");

    const input = new TerraformVariable(stack, "input", {
      type: "string",
    });

    new TerraformOutput(stack, "result", {
      value: input.value,
      description: "The output value",
    });

    const result = app.synth();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.get("test")).toMatchSnapshot();
    }
  });

  test("stack with local", () => {
    const app = new App();
    const stack = new TerraformStack(app, "test");

    new TerraformLocal(stack, "config", {
      expression: { env: "production", debug: false },
    });

    const result = app.synth();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.get("test")).toMatchSnapshot();
    }
  });

  test("stack with S3 backend", () => {
    const app = new App();
    const stack = new TerraformStack(app, "test");

    new S3Backend(stack, {
      bucket: "my-tf-state",
      key: "terraform.tfstate",
      region: "us-east-1",
      encrypt: true,
    });

    const result = app.synth();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.get("test")).toMatchSnapshot();
    }
  });

  test("multiple stacks are isolated", () => {
    const app = new App();
    const stack1 = new TerraformStack(app, "stack-1");
    const stack2 = new TerraformStack(app, "stack-2");

    new TerraformVariable(stack1, "var1", { default: "value1" });
    new TerraformVariable(stack2, "var2", { default: "value2" });

    const result = app.synth();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.get("stack-1")).toMatchSnapshot();
      expect(result.value.get("stack-2")).toMatchSnapshot();
    }
  });

  test("variable token values", () => {
    const app = new App();
    const stack = new TerraformStack(app, "test");

    const variable = new TerraformVariable(stack, "my_var", {
      type: "string",
    });

    expect(variable.stringValue).toBe("${var.my_var}");
  });

  test("local reference values", () => {
    const app = new App();
    const stack = new TerraformStack(app, "test");

    const local = new TerraformLocal(stack, "my_local", {
      expression: "computed",
    });

    expect(local.asString).toBe("${local.my_local}");
  });
});
