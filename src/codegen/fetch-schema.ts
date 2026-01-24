import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { type ProviderConstraint, parseTerraformSchema, type TerraformSchema } from "./schema.js";

export function fetchProviderSchema(
  constraint: ProviderConstraint,
  workDir: string,
): TerraformSchema {
  const tfConfig = {
    terraform: {
      required_providers: {
        [constraint.name]: {
          source: constraint.fqn,
          ...(constraint.version !== undefined ? { version: constraint.version } : {}),
        },
      },
    },
  };

  mkdirSync(workDir, { recursive: true });
  writeFileSync(`${workDir}/main.tf.json`, JSON.stringify(tfConfig, null, 2));

  console.log(`    Running terraform init...`);
  execSync("terraform init -no-color", { cwd: workDir, stdio: "pipe" });

  console.log(`    Fetching provider schema...`);
  const schemaOutput = execSync("terraform providers schema -json", {
    cwd: workDir,
    stdio: "pipe",
  });

  const rawSchema: unknown = JSON.parse(schemaOutput.toString());
  return parseTerraformSchema(rawSchema);
}

export function cleanupWorkDir(workDir: string): void {
  rmSync(workDir, { recursive: true, force: true });
}
