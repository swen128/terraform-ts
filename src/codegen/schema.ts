import { ok, err, type Result } from "neverthrow";
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
