// Raw types matching Terraform provider schema JSON output

export type RawSchemaType =
  | "string"
  | "number"
  | "bool"
  | "dynamic"
  | readonly ["list", RawSchemaType]
  | readonly ["set", RawSchemaType]
  | readonly ["map", RawSchemaType]
  | readonly ["object", Record<string, RawSchemaType>]
  | readonly ["tuple", RawSchemaType[]];

export type RawAttributeSchema = {
  readonly type: RawSchemaType;
  readonly description?: string;
  readonly description_kind?: "plain" | "markdown";
  readonly required?: boolean;
  readonly optional?: boolean;
  readonly computed?: boolean;
  readonly sensitive?: boolean;
  readonly deprecated?: boolean;
};

export type RawBlockTypeSchema = {
  readonly nesting_mode: "single" | "list" | "set" | "map";
  readonly block: RawSchemaBlock;
  readonly min_items?: number;
  readonly max_items?: number;
};

export type RawSchemaBlock = {
  readonly attributes?: Readonly<Record<string, RawAttributeSchema>>;
  readonly block_types?: Readonly<Record<string, RawBlockTypeSchema>>;
  readonly description?: string;
  readonly description_kind?: "plain" | "markdown";
  readonly deprecated?: boolean;
};

export type RawResourceSchema = {
  readonly version: number;
  readonly block: RawSchemaBlock;
};

export type RawProviderSchemaEntry = {
  readonly provider: RawResourceSchema;
  readonly resource_schemas?: Readonly<Record<string, RawResourceSchema>>;
  readonly data_source_schemas?: Readonly<Record<string, RawResourceSchema>>;
};

export type RawProviderSchema = {
  readonly format_version: string;
  readonly provider_schemas: Readonly<Record<string, RawProviderSchemaEntry>>;
};
