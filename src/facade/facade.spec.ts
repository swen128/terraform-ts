import { test, expect, describe } from "bun:test";
import { App } from "./app.js";
import { TerraformStack } from "./stack.js";
import { TerraformVariable } from "./variable.js";
import { TerraformOutput } from "./output.js";
import { TerraformLocal } from "./local.js";
import { S3Backend } from "./backends/s3.js";

describe("Facade Integration", () => {
  test("App with stack synthesizes to valid JSON", () => {
    const app = new App({ outdir: "test-out" });
    new TerraformStack(app, "test-stack");

    const result = app.synth();
    expect(result.isOk()).toBe(true);

    if (result.isOk()) {
      const stacks = result.value;
      expect(stacks.size).toBe(1);
      expect(stacks.has("test-stack")).toBe(true);

      const stackJson = stacks.get("test-stack");
      expect(stackJson).toBeDefined();
    }
  });

  test("Stack with variable synthesizes correctly", () => {
    const app = new App();
    const stack = new TerraformStack(app, "my-stack");

    new TerraformVariable(stack, "region", {
      type: "string",
      default: "us-east-1",
      description: "AWS region",
    });

    const result = app.synth();
    expect(result.isOk()).toBe(true);

    if (result.isOk()) {
      const stackJson = result.value.get("my-stack");
      expect(stackJson?.variable).toBeDefined();
      expect(stackJson?.variable?.["region"]).toBeDefined();
      expect(stackJson?.variable?.["region"]?.default).toBe("us-east-1");
    }
  });

  test("Stack with output synthesizes correctly", () => {
    const app = new App();
    const stack = new TerraformStack(app, "my-stack");

    const variable = new TerraformVariable(stack, "input", {
      type: "string",
    });

    new TerraformOutput(stack, "result", {
      value: variable.value,
      description: "The output value",
    });

    const result = app.synth();
    expect(result.isOk()).toBe(true);

    if (result.isOk()) {
      const stackJson = result.value.get("my-stack");
      expect(stackJson?.output).toBeDefined();
      expect(stackJson?.output?.["result"]).toBeDefined();
    }
  });

  test("Stack with local synthesizes correctly", () => {
    const app = new App();
    const stack = new TerraformStack(app, "my-stack");

    new TerraformLocal(stack, "computed", {
      expression: "hello-world",
    });

    const result = app.synth();
    expect(result.isOk()).toBe(true);

    if (result.isOk()) {
      const stackJson = result.value.get("my-stack");
      expect(stackJson?.locals).toBeDefined();
    }
  });

  test("Stack with backend synthesizes correctly", () => {
    const app = new App();
    const stack = new TerraformStack(app, "my-stack");

    new S3Backend(stack, {
      bucket: "my-tf-state",
      key: "terraform.tfstate",
      region: "us-east-1",
      encrypt: true,
    });

    const result = app.synth();
    expect(result.isOk()).toBe(true);

    if (result.isOk()) {
      const stackJson = result.value.get("my-stack");
      expect(stackJson?.terraform?.backend).toBeDefined();
      expect(stackJson?.terraform?.backend?.["s3"]).toBeDefined();
    }
  });

  test("Multiple stacks synthesize independently", () => {
    const app = new App();
    const stack1 = new TerraformStack(app, "stack-1");
    const stack2 = new TerraformStack(app, "stack-2");

    new TerraformVariable(stack1, "var1", { default: "value1" });
    new TerraformVariable(stack2, "var2", { default: "value2" });

    const result = app.synth();
    expect(result.isOk()).toBe(true);

    if (result.isOk()) {
      expect(result.value.size).toBe(2);

      const stack1Json = result.value.get("stack-1");
      const stack2Json = result.value.get("stack-2");

      expect(stack1Json?.variable?.["var1"]).toBeDefined();
      expect(stack1Json?.variable?.["var2"]).toBeUndefined();

      expect(stack2Json?.variable?.["var2"]).toBeDefined();
      expect(stack2Json?.variable?.["var1"]).toBeUndefined();
    }
  });

  test("Variable provides correct token values", () => {
    const app = new App();
    const stack = new TerraformStack(app, "my-stack");

    const variable = new TerraformVariable(stack, "my_var", {
      type: "string",
    });

    expect(variable.stringValue).toBe("${var.my_var}");
  });

  test("Local provides correct reference values", () => {
    const app = new App();
    const stack = new TerraformStack(app, "my-stack");

    const local = new TerraformLocal(stack, "my_local", {
      expression: "computed",
    });

    expect(local.asString).toBe("${local.my_local}");
  });
});
