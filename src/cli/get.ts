import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cleanupWorkDir,
  fetchProviderSchema,
  generateProviderBindings,
  parseProviderConstraint,
} from "../codegen/index.js";
import { findConfig, readConfig } from "./config.js";

export type GetOptions = {
  cwd?: string;
  output?: string;
  providers?: string[];
  modules?: string[];
};

export async function get(options: GetOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();

  const configPath = findConfig(cwd);
  const config = configPath !== null ? readConfig(configPath) : null;

  const providers = options.providers ?? config?.terraformProviders ?? [];
  const modules = options.modules ?? config?.terraformModules ?? [];
  const output = options.output ?? config?.codeMakerOutput ?? ".gen";

  if (providers.length === 0 && modules.length === 0) {
    console.log(
      "No providers or modules specified. Add them to cdktf.json or use --providers/--modules flags.",
    );
    return;
  }

  console.log("Generating provider bindings...");
  console.log(`  Output: ${output}`);

  for (const provider of providers) {
    console.log(`  Generating: ${provider}`);
    await generateProvider(provider, `${cwd}/${output}`);
  }

  for (const module of modules) {
    console.log(`  Generating: ${module}`);
    await generateModule(module, `${cwd}/${output}`);
  }

  console.log("\nGeneration complete!");
}

async function generateProvider(providerSpec: string, outputDir: string): Promise<void> {
  const constraint = parseProviderConstraint(providerSpec);
  const workDir = join(tmpdir(), `tfts-schema-${constraint.name}-${Date.now()}`);

  try {
    console.log(`    Fetching schema for ${constraint.fqn}@${constraint.version ?? "latest"}...`);

    const { schema, resolvedVersion } = fetchProviderSchema(constraint, workDir);
    const constraintWithVersion = {
      ...constraint,
      version: resolvedVersion ?? constraint.version,
    };
    const result = generateProviderBindings(constraintWithVersion, schema);

    if (result.isErr()) {
      console.error(`    Error: ${result.error.message}`);
      return;
    }

    for (const file of result.value) {
      const filePath = join(outputDir, file.path);
      const dir = filePath.substring(0, filePath.lastIndexOf("/"));
      await mkdir(dir, { recursive: true });
      await writeFile(filePath, file.content);
    }

    console.log(`    Generated ${result.value.length} files`);
  } finally {
    cleanupWorkDir(workDir);
  }
}

function parseModuleSpec(spec: string): {
  namespace: string;
  name: string;
  provider: string;
  version: string;
} | null {
  const atIndex = spec.indexOf("@");
  const fullName = atIndex === -1 ? spec : spec.slice(0, atIndex);
  const version = atIndex === -1 ? "latest" : spec.slice(atIndex + 1);
  const parts = fullName.split("/");

  if (parts.length < 3) {
    return null;
  }

  return {
    namespace: parts[0] ?? "",
    name: parts[1] ?? "",
    provider: parts[2] ?? "",
    version,
  };
}

async function generateModule(moduleSpec: string, outputDir: string): Promise<void> {
  const parsed = parseModuleSpec(moduleSpec);
  if (!parsed) {
    console.log(`    Skipping ${moduleSpec}: invalid module format`);
    return;
  }

  const { namespace, name, provider, version } = parsed;
  const moduleDir = `${outputDir}/modules/${namespace}/${name}/${provider}`;
  await mkdir(moduleDir, { recursive: true });

  console.log(`    Generating module ${namespace}/${name}/${provider}@${version}...`);

  const className = capitalize(name);
  const content = `import { TerraformModule } from "../../../facade/terraform-module.js";
import type { Construct } from "../../../facade/construct.js";

export type ${className}ModuleConfig = {
  readonly source?: string;
  readonly version?: string;
};

export class ${className}Module extends TerraformModule {
  constructor(scope: Construct, id: string, config: ${className}ModuleConfig = {}) {
    super(scope, id, {
      source: "${namespace}/${name}/${provider}",
      version: config.version ?? "${version}",
    });
  }
}
`;

  await writeFile(`${moduleDir}/index.ts`, content);
}

function capitalize(str: string): string {
  return str
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
