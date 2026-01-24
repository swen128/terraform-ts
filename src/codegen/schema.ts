import { z } from "zod";

export type AttributeType =
  | "string"
  | "number"
  | "bool"
  | "dynamic"
  | ["list", AttributeType]
  | ["set", AttributeType]
  | ["map", AttributeType]
  | ["object", Record<string, AttributeType>]
  | ["tuple", AttributeType[]];

export type Attribute = {
  type?: AttributeType;
  description?: string;
  required?: boolean;
  optional?: boolean;
  computed?: boolean;
  sensitive?: boolean;
  deprecated?: boolean;
};

export type BlockType = {
  nesting_mode: "single" | "list" | "set" | "map";
  block: Block;
  min_items?: number;
  max_items?: number;
};

export type Block = {
  attributes?: Record<string, Attribute>;
  block_types?: Record<string, BlockType>;
  description?: string;
  deprecated?: boolean;
};

export type ResourceSchema = {
  version: number;
  block: Block;
};

export type ProviderSchema = {
  provider?: { block: Block };
  resource_schemas?: Record<string, ResourceSchema>;
  data_source_schemas?: Record<string, ResourceSchema>;
};

export type TerraformSchema = {
  format_version: string;
  provider_schemas?: Record<string, ProviderSchema>;
};

const AttributeTypeSchema: z.ZodType<AttributeType> = z.lazy(() =>
  z.union([
    z.literal("string"),
    z.literal("number"),
    z.literal("bool"),
    z.literal("dynamic"),
    z.tuple([z.literal("list"), AttributeTypeSchema]),
    z.tuple([z.literal("set"), AttributeTypeSchema]),
    z.tuple([z.literal("map"), AttributeTypeSchema]),
    z.tuple([z.literal("object"), z.record(z.string(), AttributeTypeSchema)]),
    z.tuple([z.literal("tuple"), z.array(AttributeTypeSchema)]),
  ]),
);

const AttributeSchema: z.ZodType<Attribute> = z.object({
  type: AttributeTypeSchema.optional(),
  description: z.string().optional(),
  required: z.boolean().optional(),
  optional: z.boolean().optional(),
  computed: z.boolean().optional(),
  sensitive: z.boolean().optional(),
  deprecated: z.boolean().optional(),
});

const BlockSchema: z.ZodType<Block> = z.lazy(() =>
  z.object({
    attributes: z.record(z.string(), AttributeSchema).optional(),
    block_types: z.record(z.string(), BlockTypeSchema).optional(),
    description: z.string().optional(),
    deprecated: z.boolean().optional(),
  }),
);

const BlockTypeSchema: z.ZodType<BlockType> = z.object({
  nesting_mode: z.enum(["single", "list", "set", "map"]),
  block: BlockSchema,
  min_items: z.number().optional(),
  max_items: z.number().optional(),
});

const ResourceSchemaSchema: z.ZodType<ResourceSchema> = z.object({
  version: z.number(),
  block: BlockSchema,
});

const ProviderSchemaSchema: z.ZodType<ProviderSchema> = z.object({
  provider: z.object({ block: BlockSchema }).optional(),
  resource_schemas: z.record(z.string(), ResourceSchemaSchema).optional(),
  data_source_schemas: z.record(z.string(), ResourceSchemaSchema).optional(),
});

const TerraformSchemaValidator: z.ZodType<TerraformSchema> = z.object({
  format_version: z.string(),
  provider_schemas: z.record(z.string(), ProviderSchemaSchema).optional(),
});

export function parseTerraformSchema(data: unknown): TerraformSchema {
  return TerraformSchemaValidator.parse(data);
}

export type ProviderConstraint = {
  namespace: string;
  name: string;
  version?: string;
  fqn: string;
};

export function parseProviderConstraint(spec: string): ProviderConstraint {
  const atIndex = spec.indexOf("@");
  const fullName = atIndex === -1 ? spec : spec.slice(0, atIndex);
  const version = atIndex === -1 ? undefined : spec.slice(atIndex + 1);
  const parts = fullName.split("/");
  const namespace = parts.length > 1 ? (parts[0] ?? "hashicorp") : "hashicorp";
  const name = parts.length > 1 ? (parts[1] ?? fullName) : fullName;
  return {
    namespace,
    name,
    version,
    fqn: `${namespace}/${name}`,
  };
}
