import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { type ProviderConstraint, parseTerraformSchema, type TerraformSchema } from "./schema.js";

export type FetchSchemaResult = {
  readonly schema: TerraformSchema;
  readonly resolvedVersion: string | undefined;
};

export function parseProviderVersionFromLockFile(
  lockFilePath: string,
  providerFqn: string,
): string | undefined {
  const content = readFileSync(lockFilePath, "utf-8");

  // HCL format: provider "registry.terraform.io/hashicorp/google" { version = "1.2.3" ... }
  const escapedFqn = providerFqn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const providerBlockRegex = new RegExp(`provider\\s+"${escapedFqn}"\\s*\\{([^}]+)\\}`, "s");
  const blockMatch = content.match(providerBlockRegex);
  if (blockMatch === null) {
    return undefined;
  }

  const versionMatch = blockMatch[1]?.match(/version\s*=\s*"([^"]+)"/);
  return versionMatch?.[1];
}

export function fetchProviderSchema(
  constraint: ProviderConstraint,
  workDir: string,
): FetchSchemaResult {
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
  const schema = parseTerraformSchema(rawSchema);

  const lockFilePath = `${workDir}/.terraform.lock.hcl`;
  const resolvedVersion = parseProviderVersionFromLockFile(
    lockFilePath,
    `registry.terraform.io/${constraint.fqn}`,
  );

  return { schema, resolvedVersion };
}

export function cleanupWorkDir(workDir: string): void {
  rmSync(workDir, { recursive: true, force: true });
}
