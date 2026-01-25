import { describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const testDir = import.meta.dir;

describe("cross-stack-references E2E", () => {
  test("synthesizes two stacks with cross-references", () => {
    execSync("bun run main.ts", { cwd: testDir, stdio: "pipe" });

    const sourceOutput = readFileSync(
      `${testDir}/cdktf.out/stacks/source-stack/cdk.tf.json`,
      "utf-8",
    );
    const sourceJson = JSON.parse(sourceOutput);

    const consumerOutput = readFileSync(
      `${testDir}/cdktf.out/stacks/consumer-stack/cdk.tf.json`,
      "utf-8",
    );
    const consumerJson = JSON.parse(consumerOutput);

    expect(sourceJson.resource.null_resource["source-resource"].triggers.timestamp).toBe("initial");
    expect(sourceJson.output["source-id"].value).toBe("${null_resource.source-resource.id}");

    expect(consumerJson.resource.null_resource["consumer-resource"].triggers.source_ref).toBe(
      "${null_resource.source-resource.id}",
    );
    expect(consumerJson.output["consumer-source-ref"].value).toBe(
      "${null_resource.source-resource.id}",
    );
  });

  test("source stack passes terraform validate", () => {
    const cwd = `${testDir}/cdktf.out/stacks/source-stack`;
    execSync("rm -rf .terraform .terraform.lock.hcl", { cwd, stdio: "pipe" });
    execSync("terraform init -no-color", { cwd, stdio: "pipe" });
    const result = execSync("terraform validate -json", { cwd, encoding: "utf-8" });
    expect(JSON.parse(result).valid).toBe(true);
  });
});
