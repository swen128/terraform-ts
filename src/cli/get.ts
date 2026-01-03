import { ok, err, type Result } from "neverthrow";
import * as fs from "node:fs/promises";
import { readConfig, type ConfigError } from "./config.js";
import { generateProvider } from "../codegen/generator.js";
import { fetchProviderSchema, type SchemaError } from "../codegen/schema.js";

export type GetOptions = {
  readonly configPath?: string;
  readonly output?: string;
};

export type GetError =
  | { readonly kind: "config"; readonly error: ConfigError }
  | { readonly kind: "schema"; readonly error: SchemaError }
  | { readonly kind: "io"; readonly message: string };

export const runGet = async (options: GetOptions): Promise<Result<void, GetError>> => {
  const configPath = options.configPath ?? "cdktf.json";
  const configResult = await readConfig(configPath);

  if (configResult.isErr()) {
    return err({ kind: "config", error: configResult.error });
  }

  const config = configResult.value;
  const outdir = options.output ?? config.codeMakerOutput ?? ".gen";

  const providers = config.terraformProviders ?? [];

  for (const provider of providers) {
    const version = provider.version ?? "latest";
    const schemaResult = await fetchProviderSchema(provider.source, version);

    if (schemaResult.isErr()) {
      return err({ kind: "schema", error: schemaResult.error });
    }

    const code = generateProvider(provider.name, schemaResult.value);
    const providerDir = `${outdir}/providers/${provider.name}`;

    await fs.mkdir(providerDir, { recursive: true });
    await fs.writeFile(`${providerDir}/index.ts`, code);
  }

  return ok(undefined);
};

export const generateBindings = async (
  providers: readonly { name: string; source: string; version?: string }[],
  outdir: string,
): Promise<Result<void, GetError>> => {
  for (const provider of providers) {
    const version = provider.version ?? "latest";
    const schemaResult = await fetchProviderSchema(provider.source, version);

    if (schemaResult.isErr()) {
      return err({ kind: "schema", error: schemaResult.error });
    }

    const code = generateProvider(provider.name, schemaResult.value);
    const providerDir = `${outdir}/providers/${provider.name}`;

    await fs.mkdir(providerDir, { recursive: true });
    await fs.writeFile(`${providerDir}/index.ts`, code);
  }

  return ok(undefined);
};
