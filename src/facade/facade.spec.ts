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
import { LocalBackend } from "./backends/local.js";
import { GcsBackend } from "./backends/gcs.js";
import { RemoteBackend } from "./backends/remote.js";
import { raw } from "../core/tokens.js";
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

describe("Backends", () => {
  test("LocalBackend with default config", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      const stack = new TerraformStack(app, "test");

      new LocalBackend(stack);

      app.synth();

      expect(readStackOutput(outdir, "test")).toMatchSnapshot();
    });
  });

  test("LocalBackend with path", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      const stack = new TerraformStack(app, "test");

      new LocalBackend(stack, {
        path: "./terraform.tfstate",
        workspaceDir: "./.terraform/workspaces",
      });

      app.synth();

      expect(readStackOutput(outdir, "test")).toMatchSnapshot();
    });
  });

  test("GcsBackend", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      const stack = new TerraformStack(app, "test");

      new GcsBackend(stack, {
        bucket: "my-terraform-state",
        prefix: "terraform/state",
      });

      app.synth();

      expect(readStackOutput(outdir, "test")).toMatchSnapshot();
    });
  });

  test("GcsBackend with impersonation", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      const stack = new TerraformStack(app, "test");

      new GcsBackend(stack, {
        bucket: "my-terraform-state",
        prefix: "terraform/state",
        impersonateServiceAccount: "terraform@project.iam.gserviceaccount.com",
      });

      app.synth();

      expect(readStackOutput(outdir, "test")).toMatchSnapshot();
    });
  });

  test("RemoteBackend with workspace name", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      const stack = new TerraformStack(app, "test");

      new RemoteBackend(stack, {
        organization: "my-org",
        workspaces: { name: "my-workspace" },
      });

      app.synth();

      expect(readStackOutput(outdir, "test")).toMatchSnapshot();
    });
  });

  test("RemoteBackend with workspace prefix", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      const stack = new TerraformStack(app, "test");

      new RemoteBackend(stack, {
        hostname: "app.terraform.io",
        organization: "my-org",
        workspaces: { prefix: "my-app-" },
      });

      app.synth();

      expect(readStackOutput(outdir, "test")).toMatchSnapshot();
    });
  });
});

describe("Variables", () => {
  test("variable with all types", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      const stack = new TerraformStack(app, "test");

      new TerraformVariable(stack, "string_var", {
        type: "string",
        default: "hello",
      });

      new TerraformVariable(stack, "number_var", {
        type: "number",
        default: 42,
      });

      new TerraformVariable(stack, "bool_var", {
        type: "bool",
        default: true,
      });

      new TerraformVariable(stack, "list_var", {
        type: "list(string)",
        default: ["a", "b", "c"],
      });

      new TerraformVariable(stack, "map_var", {
        type: "map(string)",
        default: { key1: "value1", key2: "value2" },
      });

      app.synth();

      expect(readStackOutput(outdir, "test")).toMatchSnapshot();
    });
  });

  test("variable with nullable", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      const stack = new TerraformStack(app, "test");

      new TerraformVariable(stack, "nullable_var", {
        type: "string",
        nullable: true,
        default: null,
      });

      new TerraformVariable(stack, "non_nullable_var", {
        type: "string",
        nullable: false,
        default: "required",
      });

      app.synth();

      expect(readStackOutput(outdir, "test")).toMatchSnapshot();
    });
  });

  test("variable with sensitive", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      const stack = new TerraformStack(app, "test");

      new TerraformVariable(stack, "password", {
        type: "string",
        sensitive: true,
        description: "Database password",
      });

      app.synth();

      expect(readStackOutput(outdir, "test")).toMatchSnapshot();
    });
  });

  test("variable with validation", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      const stack = new TerraformStack(app, "test");

      new TerraformVariable(stack, "instance_type", {
        type: "string",
        default: "t2.micro",
        validation: [
          {
            condition: raw('can(regex("^t2\\\\.", var.instance_type))'),
            errorMessage: "Must be a t2 instance type",
          },
        ],
      });

      app.synth();

      expect(readStackOutput(outdir, "test")).toMatchSnapshot();
    });
  });

  test("variable with multiple validations", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      const stack = new TerraformStack(app, "test");

      new TerraformVariable(stack, "port", {
        type: "number",
        validation: [
          {
            condition: raw("var.port > 0"),
            errorMessage: "Port must be positive",
          },
          {
            condition: raw("var.port < 65536"),
            errorMessage: "Port must be less than 65536",
          },
        ],
      });

      app.synth();

      expect(readStackOutput(outdir, "test")).toMatchSnapshot();
    });
  });
});

describe("Outputs", () => {
  test("output with sensitive", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      const stack = new TerraformStack(app, "test");

      new TerraformOutput(stack, "secret_output", {
        value: "sensitive-data",
        sensitive: true,
        description: "A sensitive output",
      });

      app.synth();

      expect(readStackOutput(outdir, "test")).toMatchSnapshot();
    });
  });

  test("output with complex value", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      const stack = new TerraformStack(app, "test");

      new TerraformOutput(stack, "config", {
        value: {
          endpoint: "https://api.example.com",
          port: 443,
          enabled: true,
        },
      });

      app.synth();

      expect(readStackOutput(outdir, "test")).toMatchSnapshot();
    });
  });

  test("output with list value", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      const stack = new TerraformStack(app, "test");

      new TerraformOutput(stack, "zones", {
        value: ["us-east-1a", "us-east-1b", "us-east-1c"],
        description: "Availability zones",
      });

      app.synth();

      expect(readStackOutput(outdir, "test")).toMatchSnapshot();
    });
  });
});

describe("Locals", () => {
  test("local with complex object", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      const stack = new TerraformStack(app, "test");

      new TerraformLocal(stack, "settings", {
        expression: {
          database: {
            host: "localhost",
            port: 5432,
            name: "mydb",
          },
          cache: {
            enabled: true,
            ttl: 300,
          },
        },
      });

      app.synth();

      expect(readStackOutput(outdir, "test")).toMatchSnapshot();
    });
  });

  test("local with token reference", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      const stack = new TerraformStack(app, "test");

      const region = new TerraformVariable(stack, "region", {
        type: "string",
        default: "us-east-1",
      });

      new TerraformLocal(stack, "full_name", {
        expression: `my-app-${region.stringValue}`,
      });

      app.synth();

      expect(readStackOutput(outdir, "test")).toMatchSnapshot();
    });
  });

  test("local with list expression", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      const stack = new TerraformStack(app, "test");

      new TerraformLocal(stack, "ports", {
        expression: [80, 443, 8080],
      });

      app.synth();

      expect(readStackOutput(outdir, "test")).toMatchSnapshot();
    });
  });

  test("local reference values", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      const stack = new TerraformStack(app, "test");

      const local = new TerraformLocal(stack, "config", {
        expression: { key: "value" },
      });

      expect(local.asString).toBe("${local.config}");
      expect(local.asNumber.toHcl()).toBe("${local.config}");
      expect(local.asBoolean.toHcl()).toBe("${local.config}");
      expect(local.asList.toHcl()).toBe("${local.config}");
    });
  });

  test("multiple locals referencing each other", () => {
    withTempDir((outdir) => {
      const app = new App({ outdir });
      const stack = new TerraformStack(app, "test");

      const base = new TerraformLocal(stack, "base_name", {
        expression: "my-app",
      });

      new TerraformLocal(stack, "full_name", {
        expression: `${base.asString}-production`,
      });

      app.synth();

      expect(readStackOutput(outdir, "test")).toMatchSnapshot();
    });
  });
});
