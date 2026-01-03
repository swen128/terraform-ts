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
