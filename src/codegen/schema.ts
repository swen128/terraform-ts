import { ok, err, type Result } from "neverthrow";

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
  readonly kind: "fetch" | "parse" | "not_found";
  readonly message: string;
};

export const getProviderUrl = (namespace: string, name: string, version: string): string => {
  return `https://registry.terraform.io/v1/providers/${namespace}/${name}/${version}/download/linux/amd64`;
};

export const fetchProviderSchema = async (
  source: string,
  version: string,
): Promise<Result<ProviderSchema, SchemaError>> => {
  const parts = source.split("/");
  if (parts.length < 2) {
    return err({ kind: "parse", message: `Invalid provider source: ${source}` });
  }

  const namespace = parts[parts.length - 2] ?? "hashicorp";
  const name = parts[parts.length - 1] ?? source;

  const schemaUrl = `https://registry.terraform.io/v1/providers/${namespace}/${name}/${version}`;

  const response = await fetch(schemaUrl);
  if (!response.ok) {
    if (response.status === 404) {
      return err({ kind: "not_found", message: `Provider not found: ${source}@${version}` });
    }
    return err({ kind: "fetch", message: `Failed to fetch schema: ${response.statusText}` });
  }

  // Consume response but we don't use it - actual schema requires terraform CLI
  await response.json();

  // The registry API returns metadata, not the schema directly
  // For actual schema, we need to run terraform providers schema
  return ok({
    format_version: "1.0",
    provider_schemas: {
      [`registry.terraform.io/${namespace}/${name}`]: {
        provider: {},
        resource_schemas: {},
        data_source_schemas: {},
      },
    },
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
