import { type ProviderConstraint, parseTerraformSchema, type TerraformSchema } from "./schema.js";

export async function fetchProviderSchema(
  constraint: ProviderConstraint,
  workDir: string,
): Promise<TerraformSchema> {
  const tfConfig = {
    terraform: {
      required_providers: {
        [constraint.name]: {
          source: constraint.fqn,
          ...(constraint.version ? { version: constraint.version } : {}),
        },
      },
    },
  };

  await Bun.$`mkdir -p ${workDir}`;
  await Bun.write(`${workDir}/main.tf.json`, JSON.stringify(tfConfig, null, 2));

  console.log(`    Running terraform init...`);
  const initResult = await Bun.$`cd ${workDir} && terraform init -no-color`.quiet();
  if (initResult.exitCode !== 0) {
    throw new Error(`terraform init failed: ${initResult.stderr.toString()}`);
  }

  console.log(`    Fetching provider schema...`);
  const schemaResult = await Bun.$`cd ${workDir} && terraform providers schema -json`.quiet();
  if (schemaResult.exitCode !== 0) {
    throw new Error(`terraform providers schema failed: ${schemaResult.stderr.toString()}`);
  }

  const rawSchema = JSON.parse(schemaResult.stdout.toString());
  return parseTerraformSchema(rawSchema);
}

export async function cleanupWorkDir(workDir: string): Promise<void> {
  await Bun.$`rm -rf ${workDir}`.quiet();
}
