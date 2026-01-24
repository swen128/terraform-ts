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
}

export type BlockType = {
  nesting_mode: "single" | "list" | "set" | "map";
  block: Block;
  min_items?: number;
  max_items?: number;
}

export type Block = {
  attributes?: Record<string, Attribute>;
  block_types?: Record<string, BlockType>;
  description?: string;
  deprecated?: boolean;
}

export type ResourceSchema = {
  version: number;
  block: Block;
}

export type ProviderSchema = {
  provider?: { block: Block };
  resource_schemas?: Record<string, ResourceSchema>;
  data_source_schemas?: Record<string, ResourceSchema>;
}

export type TerraformSchema = {
  format_version: string;
  provider_schemas?: Record<string, ProviderSchema>;
}

const TerraformSchemaValidator = z.object({
  format_version: z.string(),
  provider_schemas: z.record(z.string(), z.unknown()).optional(),
});

export function parseTerraformSchema(data: unknown): TerraformSchema {
  const validated = TerraformSchemaValidator.parse(data);
  return validated as TerraformSchema;
}

export type ProviderConstraint = {
  namespace: string;
  name: string;
  version?: string;
  fqn: string;
}

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
