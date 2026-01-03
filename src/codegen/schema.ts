import { ok, err, type Result } from "neverthrow";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type ProviderSchema = {
  readonly format_version: string;
  readonly provider_schemas: Readonly<Record<string, ProviderSchemaEntry>>;
};

export type ProviderSchemaEntry = {
  readonly provider: SchemaBlock;
  readonly resource_schemas: Readonly<Record<string, ResourceSchema>>;
  readonly data_source_schemas: Readonly<Record<string, ResourceSchema>>;
};

export type ResourceSchema = {
  readonly version: number;
  readonly block: SchemaBlock;
};

export type SchemaBlock = {
  readonly attributes?: Readonly<Record<string, AttributeSchema>>;
  readonly block_types?: Readonly<Record<string, BlockTypeSchema>>;
  readonly description?: string;
  readonly description_kind?: "plain" | "markdown";
  readonly deprecated?: boolean;
};

export type AttributeSchema = {
  readonly type: SchemaType;
  readonly description?: string;
  readonly description_kind?: "plain" | "markdown";
  readonly required?: boolean;
  readonly optional?: boolean;
  readonly computed?: boolean;
  readonly sensitive?: boolean;
  readonly deprecated?: boolean;
};

export type BlockTypeSchema = {
  readonly nesting_mode: "single" | "list" | "set" | "map";
  readonly block: SchemaBlock;
  readonly min_items?: number;
  readonly max_items?: number;
};

export type SchemaType =
  | "string"
  | "number"
  | "bool"
  | "dynamic"
  | readonly ["list", SchemaType]
  | readonly ["set", SchemaType]
  | readonly ["map", SchemaType]
  | readonly ["object", Readonly<Record<string, SchemaType>>]
  | readonly ["tuple", readonly SchemaType[]];

export type SchemaError = {
  readonly kind: "init" | "schema" | "parse";
  readonly message: string;
};

const withTempDir = async <T>(
  prefix: string,
  fn: (dir: string) => Promise<T>,
): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), `${prefix}-`));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

export const fetchProviderSchema = async (
  source: string,
  version?: string,
): Promise<Result<ProviderSchema, SchemaError>> => {
  const parts = source.split("/");
  const name = parts[parts.length - 1] ?? source;

  return withTempDir("tfts-schema", async (dir) => {
    const config = {
      terraform: {
        required_providers: {
          [name]: {
            source,
            ...(version !== undefined ? { version } : {}),
          },
        },
      },
    };

    await Bun.write(join(dir, "main.tf.json"), JSON.stringify(config));

    const initResult = await Bun.$`terraform -chdir=${dir} init`.quiet();
    if (initResult.exitCode !== 0) {
      return err({
        kind: "init",
        message: `terraform init failed: ${initResult.stderr.toString()}`,
      });
    }

    const schemaResult =
      await Bun.$`terraform -chdir=${dir} providers schema -json`.quiet();
    if (schemaResult.exitCode !== 0) {
      return err({
        kind: "schema",
        message: `terraform providers schema failed: ${schemaResult.stderr.toString()}`,
      });
    }

    const parsed: unknown = JSON.parse(schemaResult.stdout.toString());
    return ok(parsed as ProviderSchema);
  });
};

export const parseSchemaType = (type: SchemaType): string => {
  if (typeof type === "string") {
    switch (type) {
      case "string":
        return "string";
      case "number":
        return "number";
      case "bool":
        return "boolean";
      case "dynamic":
        return "unknown";
    }
  }

  const [kind, inner] = type;
  switch (kind) {
    case "list":
    case "set":
      return `readonly ${parseSchemaType(inner)}[]`;
    case "map":
      return `Readonly<Record<string, ${parseSchemaType(inner)}>>`;
    case "object": {
      const props = Object.entries(inner)
        .map(([k, v]) => `readonly ${k}: ${parseSchemaType(v)}`)
        .join("; ");
      return `{ ${props} }`;
    }
    case "tuple":
      return `readonly [${inner.map(parseSchemaType).join(", ")}]`;
  }
};
