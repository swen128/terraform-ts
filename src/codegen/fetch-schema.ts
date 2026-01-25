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

  execSync("terraform init -no-color", {
    cwd: workDir,
    stdio: "pipe",
    maxBuffer: 100 * 1024 * 1024,
  });
  const schemaOutput = execSync("terraform providers schema -json", {
    cwd: workDir,
    stdio: "pipe",
    maxBuffer: 100 * 1024 * 1024,
  });

  const rawSchema: unknown = JSON.parse(schemaOutput.toString());
  return parseTerraformSchema(rawSchema);
}

export function cleanupWorkDir(workDir: string): void {
  rmSync(workDir, { recursive: true, force: true });
}
