import { describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const testDir = import.meta.dir;

describe("synth-app E2E", () => {
  test("synthesizes valid Terraform JSON", () => {
    execSync("bun run main.ts", { cwd: testDir, stdio: "pipe" });

    const output = readFileSync(`${testDir}/cdktf.out/stacks/hello-terra/cdk.tf.json`, "utf-8");
    const json = JSON.parse(output);

    expect(json.terraform.backend.local.path).toBe("terraform.tfstate");
    expect(json.provider.null).toBeDefined();
    expect(json.variable.my_var.type).toBe("string");
    expect(json.variable.my_var.default).toBe("default-value");

    expect(json.resource.null_resource.resource1.triggers.foo).toBe("bar");
    expect(json.resource.null_resource.resource1.triggers.variable).toBe("${var.my_var}");
    expect(json.resource.null_resource.resource1.triggers.overridden).toBe("true");
    expect(json.resource.null_resource.resource1.lifecycle.create_before_destroy).toBe(true);

    expect(json.resource.null_resource.resource2.triggers.ref).toBe(
      "${null_resource.resource1.id}",
    );

    expect(json.output["resource1-id"].value).toBe("${null_resource.resource1.id}");
    expect(json.output["variable-value"].value).toBe("${var.my_var}");
    expect(json.output["joined-value"].value).toBe('${join("-", ["hello", "world"])}');
  });

  test("generated config passes terraform validate", () => {
    const cwd = `${testDir}/cdktf.out/stacks/hello-terra`;

    execSync("rm -rf .terraform .terraform.lock.hcl", { cwd, stdio: "pipe" });
    execSync("terraform init -no-color", { cwd, stdio: "pipe" });

    const result = execSync("terraform validate -json", { cwd, encoding: "utf-8" });
    const validation = JSON.parse(result);

    expect(validation.valid).toBe(true);
  });
});
