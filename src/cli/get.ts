import { ok, err, type Result } from "neverthrow";
import * as fs from "node:fs/promises";
import { join, dirname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { readConfig, type ConfigError } from "./config.js";
import { generateProviderFiles } from "../codegen/generator.js";
import { parseProviderSchema, type SchemaError, type ProviderSchema } from "../codegen/schema.js";

const execFileAsync = promisify(execFile);

const fetchProviderSchema = async (
  source: string,
  version: string,
): Promise<Result<ProviderSchema, SchemaError>> => {
  const tempDir = await fs.mkdtemp(join(tmpdir(), "tfts-"));

  try {
    const tfConfig = `
terraform {
  required_providers {
    provider = {
      source  = "${source}"
      version = "${version === "latest" ? ">= 0" : version}"
    }
  }
}
`;
    await fs.writeFile(join(tempDir, "main.tf"), tfConfig);

    await execFileAsync("terraform", ["init"], { cwd: tempDir });

    const { stdout } = await execFileAsync("terraform", ["providers", "schema", "-json"], {
      cwd: tempDir,
    });

    const data: unknown = JSON.parse(stdout);
    return parseProviderSchema(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return err({ kind: "schema", message });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};

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

    const files = generateProviderFiles(provider.name, schemaResult.value);
    const providerDir = `${outdir}/providers/${provider.name}`;

    for (const [filePath, content] of files) {
      const fullPath = join(providerDir, filePath);
      await fs.mkdir(dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content);
    }
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

    const files = generateProviderFiles(provider.name, schemaResult.value);
    const providerDir = `${outdir}/providers/${provider.name}`;

    for (const [filePath, content] of files) {
      const fullPath = join(providerDir, filePath);
      await fs.mkdir(dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content);
    }
  }

  return ok(undefined);
};
