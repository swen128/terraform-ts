import { test, expect, describe } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { App, type Manifest } from "./app.js";
import { TerraformStack } from "./stack.js";
import { TerraformVariable } from "./variable.js";
import { TerraformOutput } from "./output.js";
import { TerraformLocal } from "./local.js";
import { S3Backend } from "./backends/s3.js";
import type { TerraformJson } from "../core/terraform-json.js";

const withTempDir = (fn: (outdir: string) => void): void => {
  const outdir = mkdtempSync(join(tmpdir(), "tfts-test-"));
  try {
    fn(outdir);
  } finally {
    rmSync(outdir, { recursive: true, force: true });
  }
};

const readStackOutput = (outdir: string, stackName: string): TerraformJson => {
  const path = join(outdir, "stacks", stackName, "cdk.tf.json");
  return JSON.parse(readFileSync(path, "utf-8")) as TerraformJson;
};

const readManifest = (outdir: string): Manifest => {
  return JSON.parse(readFileSync(join(outdir, "manifest.json"), "utf-8")) as Manifest;
};

describe("Facade Integration", () => {
  test("empty stack", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      new TerraformStack(app, "test");

      app.synth();

      expect(readStackOutput(outdir, "test")).toMatchSnapshot();
    });
  });

  test("stack with variable", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      const stack = new TerraformStack(app, "test");

      new TerraformVariable(stack, "region", {
        type: "string",
        default: "us-east-1",
        description: "AWS region",
      });

      app.synth();

      expect(readStackOutput(outdir, "test")).toMatchSnapshot();
    });
  });

  test("stack with output referencing variable", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      const stack = new TerraformStack(app, "test");

      const input = new TerraformVariable(stack, "input", {
        type: "string",
      });

      new TerraformOutput(stack, "result", {
        value: input.value,
        description: "The output value",
      });

      app.synth();

      expect(readStackOutput(outdir, "test")).toMatchSnapshot();
    });
  });

  test("stack with local", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      const stack = new TerraformStack(app, "test");

      new TerraformLocal(stack, "config", {
        expression: { env: "production", debug: false },
      });

      app.synth();

      expect(readStackOutput(outdir, "test")).toMatchSnapshot();
    });
  });

  test("stack with S3 backend", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      const stack = new TerraformStack(app, "test");

      new S3Backend(stack, {
        bucket: "my-tf-state",
        key: "terraform.tfstate",
        region: "us-east-1",
        encrypt: true,
      });

      app.synth();

      expect(readStackOutput(outdir, "test")).toMatchSnapshot();
    });
  });

  test("multiple stacks are isolated", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      const stack1 = new TerraformStack(app, "stack-1");
      const stack2 = new TerraformStack(app, "stack-2");

      new TerraformVariable(stack1, "var1", { default: "value1" });
      new TerraformVariable(stack2, "var2", { default: "value2" });

      app.synth();

      expect(readStackOutput(outdir, "stack-1")).toMatchSnapshot();
      expect(readStackOutput(outdir, "stack-2")).toMatchSnapshot();
    });
  });

  test("variable token values", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      const stack = new TerraformStack(app, "test");

      const variable = new TerraformVariable(stack, "my_var", {
        type: "string",
      });

      expect(variable.stringValue).toBe("${var.my_var}");
    });
  });

  test("local reference values", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      const stack = new TerraformStack(app, "test");

      const local = new TerraformLocal(stack, "my_local", {
        expression: "computed",
      });

      expect(local.asString).toBe("${local.my_local}");
    });
  });

  test("writes manifest.json", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      new TerraformStack(app, "my-stack");

      app.synth();

      expect(readManifest(outdir)).toEqual({
        version: "1.0.0",
        stacks: {
          "my-stack": {
            name: "my-stack",
            synthesizedStackPath: "stacks/my-stack/cdk.tf.json",
            workingDirectory: "stacks/my-stack",
          },
        },
      });
    });
  });
});
