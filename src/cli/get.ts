import { findConfig, readConfig } from "./config.js";

export interface GetOptions {
  cwd?: string;
  output?: string;
  providers?: string[];
  modules?: string[];
}

export async function get(options: GetOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();

  const configPath = await findConfig(cwd);
  const config = configPath ? await readConfig(configPath) : null;

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

function parseProviderSpec(spec: string): {
  namespace: string;
  name: string;
  version: string;
} {
  const atIndex = spec.indexOf("@");
  const fullName = atIndex === -1 ? spec : spec.slice(0, atIndex);
  const version = atIndex === -1 ? "latest" : spec.slice(atIndex + 1);
  const parts = fullName.split("/");
  const namespace = parts.length > 1 ? (parts[0] ?? "hashicorp") : "hashicorp";
  const name = parts.length > 1 ? (parts[1] ?? fullName) : fullName;
  return { namespace, name, version };
}

async function generateProvider(providerSpec: string, outputDir: string): Promise<void> {
  const { namespace, name, version } = parseProviderSpec(providerSpec);

  const providerDir = `${outputDir}/providers/${namespace}/${name}`;
  await Bun.$`mkdir -p ${providerDir}`;

  console.log(`    Fetching schema for ${namespace}/${name}@${version}...`);

  const indexContent = `export * from "./${name}-provider.js";
`;

  const className = capitalize(name);
  const providerContent = `import { TerraformProvider } from "../../../facade/terraform-provider.js";
import type { Construct } from "../../../facade/construct.js";

export interface ${className}ProviderConfig {
  readonly alias?: string;
  readonly region?: string;
}

export class ${className}Provider extends TerraformProvider {
  static readonly tfResourceType = "${namespace}/${name}";

  constructor(scope: Construct, id: string, config: ${className}ProviderConfig = {}) {
    super(scope, id, {
      terraformResourceType: "${namespace}/${name}",
      terraformGeneratorMetadata: {
        providerName: "${name}",
        providerVersion: "${version}",
      },
      terraformProviderSource: "${namespace}/${name}",
    });
  }
}
`;

  await Bun.write(`${providerDir}/index.ts`, indexContent);
  await Bun.write(`${providerDir}/${name}-provider.ts`, providerContent);
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
  await Bun.$`mkdir -p ${moduleDir}`;

  console.log(`    Generating module ${namespace}/${name}/${provider}@${version}...`);

  const className = capitalize(name);
  const content = `import { TerraformModule } from "../../../facade/terraform-module.js";
import type { Construct } from "../../../facade/construct.js";

export interface ${className}ModuleConfig {
  readonly source?: string;
  readonly version?: string;
}

export class ${className}Module extends TerraformModule {
  constructor(scope: Construct, id: string, config: ${className}ModuleConfig = {}) {
    super(scope, id, {
      source: "${namespace}/${name}/${provider}",
      version: config.version ?? "${version}",
    });
  }
}
`;

  await Bun.write(`${moduleDir}/index.ts`, content);
}

function capitalize(str: string): string {
  return str
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
