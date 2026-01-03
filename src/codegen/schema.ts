import { ok, err, type Result } from "neverthrow";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { z } from "zod";

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

export type SchemaBlock = {
  readonly attributes?: Readonly<Record<string, AttributeSchema>>;
  readonly block_types?: Readonly<Record<string, BlockTypeSchema>>;
  readonly description?: string;
  readonly description_kind?: "plain" | "markdown";
  readonly deprecated?: boolean;
};

export type ResourceSchema = {
  readonly version: number;
  readonly block: SchemaBlock;
};

export type ProviderSchemaEntry = {
  readonly provider: SchemaBlock;
  readonly resource_schemas?: Readonly<Record<string, ResourceSchema>>;
  readonly data_source_schemas?: Readonly<Record<string, ResourceSchema>>;
};

export type ProviderSchema = {
  readonly format_version: string;
  readonly provider_schemas: Readonly<Record<string, ProviderSchemaEntry>>;
};

const SchemaTypeSchema: z.ZodType<SchemaType> = z.lazy(() =>
  z.union([
    z.literal("string"),
    z.literal("number"),
    z.literal("bool"),
    z.literal("dynamic"),
    z.tuple([z.literal("list"), SchemaTypeSchema]),
    z.tuple([z.literal("set"), SchemaTypeSchema]),
    z.tuple([z.literal("map"), SchemaTypeSchema]),
    z.tuple([z.literal("object"), z.record(z.string(), SchemaTypeSchema)]),
    z.tuple([z.literal("tuple"), z.array(SchemaTypeSchema)]),
  ]),
);

const AttributeSchemaSchema: z.ZodType<AttributeSchema> = z.object({
  type: SchemaTypeSchema,
  description: z.string().optional(),
  description_kind: z.enum(["plain", "markdown"]).optional(),
  required: z.boolean().optional(),
  optional: z.boolean().optional(),
  computed: z.boolean().optional(),
  sensitive: z.boolean().optional(),
  deprecated: z.boolean().optional(),
});

const BlockTypeSchemaSchema: z.ZodType<BlockTypeSchema> = z.lazy(() =>
  z.object({
    nesting_mode: z.enum(["single", "list", "set", "map"]),
    block: SchemaBlockSchema,
    min_items: z.number().optional(),
    max_items: z.number().optional(),
  }),
);

const SchemaBlockSchema: z.ZodType<SchemaBlock> = z.lazy(() =>
  z.object({
    attributes: z.record(z.string(), AttributeSchemaSchema).optional(),
    block_types: z.record(z.string(), BlockTypeSchemaSchema).optional(),
    description: z.string().optional(),
    description_kind: z.enum(["plain", "markdown"]).optional(),
    deprecated: z.boolean().optional(),
  }),
);

const ResourceSchemaSchema: z.ZodType<ResourceSchema> = z.object({
  version: z.number(),
  block: SchemaBlockSchema,
});

const ProviderSchemaEntrySchema: z.ZodType<ProviderSchemaEntry> = z.object({
  provider: SchemaBlockSchema,
  resource_schemas: z.record(z.string(), ResourceSchemaSchema).optional(),
  data_source_schemas: z.record(z.string(), ResourceSchemaSchema).optional(),
});

const ProviderSchemaSchema: z.ZodType<ProviderSchema> = z.object({
  format_version: z.string(),
  provider_schemas: z.record(z.string(), ProviderSchemaEntrySchema),
});

export type SchemaError = {
  readonly kind: "init" | "schema" | "parse";
  readonly message: string;
};

export const parseProviderSchema = (data: unknown): Result<ProviderSchema, SchemaError> => {
  const result = ProviderSchemaSchema.safeParse(data);
  if (!result.success) {
    return err({
      kind: "parse",
      message: result.error.message,
    });
  }
  return ok(result.data);
};

const withTempDir = async <T>(prefix: string, fn: (dir: string) => Promise<T>): Promise<T> => {
  const dir = await fs.mkdtemp(join(tmpdir(), `${prefix}-`));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};

const runCommand = (
  command: string,
  args: readonly string[],
): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (data: Buffer) => (stdout += data.toString()));
    proc.stderr.on("data", (data: Buffer) => (stderr += data.toString()));
    proc.on("close", (code) => resolve({ exitCode: code ?? 1, stdout, stderr }));
  });
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

    await fs.writeFile(join(dir, "main.tf.json"), JSON.stringify(config));

    const initResult = await runCommand("terraform", ["-chdir=" + dir, "init"]);
    if (initResult.exitCode !== 0) {
      return err({
        kind: "init",
        message: `terraform init failed: ${initResult.stderr}`,
      });
    }

    const schemaResult = await runCommand("terraform", [
      "-chdir=" + dir,
      "providers",
      "schema",
      "-json",
    ]);
    if (schemaResult.exitCode !== 0) {
      return err({
        kind: "schema",
        message: `terraform providers schema failed: ${schemaResult.stderr}`,
      });
    }

    const parsed: unknown = JSON.parse(schemaResult.stdout);
    return parseProviderSchema(parsed);
  });
};

export const parseSchemaType = (type: SchemaType): string => {
  if (typeof type === "string") {
    switch (type) {
      case "string":
        return "TfString";
      case "number":
        return "TfNumber";
      case "bool":
        return "TfBoolean";
      case "dynamic":
        return "unknown";
    }
  }

  const [kind, inner] = type;
  switch (kind) {
    case "list":
    case "set":
      if (inner === "string") return "TfStringList";
      if (inner === "number") return "TfNumberList";
      return `readonly ${parseSchemaType(inner)}[]`;
    case "map":
      if (inner === "string") return "TfStringMap";
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
