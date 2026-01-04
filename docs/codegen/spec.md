# Code Generator Specification

## Input

The generator takes a Terraform provider schema JSON (from `terraform providers schema -json`):

```typescript
type ProviderSchema = {
  provider_schemas: {
    [source: string]: {
      provider: SchemaBlock;
      resource_schemas?: { [name: string]: { block: SchemaBlock } };
      data_source_schemas?: { [name: string]: { block: SchemaBlock } };
    };
  };
};

type SchemaBlock = {
  attributes?: { [name: string]: Attribute };
  block_types?: { [name: string]: BlockType };
};

type Attribute = {
  type: AttributeType;
  required?: boolean;
  optional?: boolean;
  computed?: boolean;
};

type BlockType = {
  nesting_mode: "single" | "list" | "set";
  block: SchemaBlock;
  min_items?: number;
  max_items?: number;
};

type AttributeType =
  | "string" | "number" | "bool"
  | ["list", AttributeType]
  | ["set", AttributeType]
  | ["map", AttributeType];
```

## Output

For provider `google` with source `registry.terraform.io/hashicorp/google`:

```
.gen/providers/google/
├── index.ts                      # namespace exports
├── provider/
│   └── index.ts                  # provider class
└── lib/
    ├── cloud-run-service/
    │   └── index.ts              # resource class
    ├── storage-bucket/
    │   └── index.ts
    └── data-cloud-run-service/
        └── index.ts              # data source class
```

## Naming Rules

### File/Directory Names
- Provider: `provider/index.ts`
- Resource `google_cloud_run_service`: `lib/cloud-run-service/index.ts`
- Data source `google_cloud_run_service`: `lib/data-cloud-run-service/index.ts`

Rule: Strip provider prefix, replace `_` with `-`.

### Class Names
- Provider `google`: `GoogleProvider`
- Resource `google_cloud_run_service`: `CloudRunService`
- Data source `google_cloud_run_service`: `DataCloudRunService`

Rule: Strip provider prefix, convert snake_case to PascalCase.

### Type Names
- Config type: `{ClassName}Config` (e.g., `CloudRunServiceConfig`)
- Nested block type: `{ClassName}{BlockName}` (e.g., `CloudRunServiceTemplate`)
- Deeply nested: `{ParentTypeName}{BlockName}` (e.g., `CloudRunServiceTemplateSpec`)

### Collision Handling
When a type name already exists, append `A`:
- `ResourceConfig` exists, nested block `config` would be `ResourceConfig` → becomes `ResourceConfigA`

### Property Names
Convert snake_case to camelCase:
- `secret_id` → `secretId`
- `api_key` → `apiKey`

## Type Mappings

### Attribute Types
| Terraform | TypeScript (config) | TypeScript (getter return) |
|-----------|---------------------|---------------------------|
| `string` | `TfString` | `TokenString` |
| `number` | `TfNumber` | `TokenString` |
| `bool` | `TfBoolean` | `TokenString` |
| `["list", "string"]` | `TfStringList` | `TokenString` |
| `["list", "number"]` | `TfNumberList` | `TokenString` |
| `["map", "string"]` | `TfStringMap` | `TokenString` |

### Block Types
| nesting_mode | max_items | Config Property Type |
|--------------|-----------|---------------------|
| `single` | - | `T` |
| `list` or `set` | `!== 1` | `readonly T[]` |
| `list` or `set` | `=== 1` | `T \| readonly T[]` |

### Optionality
- `required: true` → required property
- `optional: true` or `computed: true` → optional property (`?`)
- Block with `min_items === 0` or `min_items === undefined` → optional

## Generated Code Structure

### Provider Class
```typescript
import type { Construct, TerraformProviderConfig, TfString } from "tfts";
import { TerraformProvider } from "tfts";

export type GoogleProviderConfig = {
  readonly project?: TfString;
  readonly region?: TfString;
} & TerraformProviderConfig;

export class GoogleProvider extends TerraformProvider {
  constructor(scope: Construct, id: string, config: GoogleProviderConfig = {}) {
    super(scope, id, "registry.terraform.io/hashicorp/google", {
      project: config.project,
      region: config.region,
    }, config);
  }
}
```

### Resource Class
```typescript
import type { Construct, TokenString, TerraformResourceConfig, TfString } from "tfts";
import { TerraformResource } from "tfts";

export type CloudRunServiceTemplate = {
  readonly containerPort?: TfNumber;
};

export type CloudRunServiceConfig = {
  readonly name: TfString;
  readonly location?: TfString;
  readonly template?: CloudRunServiceTemplate | readonly CloudRunServiceTemplate[];
} & TerraformResourceConfig;

export class CloudRunService extends TerraformResource {
  constructor(scope: Construct, id: string, config: CloudRunServiceConfig) {
    super(scope, id, "google_cloud_run_service", {
      name: config.name,
      location: config.location,
      template: config.template !== undefined
        ? (Array.isArray(config.template) ? config.template : [config.template])
        : undefined,
    }, config);
  }

  get name(): TokenString {
    return this.getStringAttribute("name");
  }

  get location(): TokenString {
    return this.getStringAttribute("location");
  }
}
```

### Data Source Class
Same as resource, but:
- Class extends `TerraformDataSource`
- Class name prefixed with `Data`
- Config type extends `TerraformDataSourceConfig`

## Constructor Body Rules

### Regular Properties
```typescript
property_name: config.propertyName,
```

### max_items=1 Block Properties
```typescript
block_name: config.blockName !== undefined
  ? (Array.isArray(config.blockName) ? config.blockName : [config.blockName])
  : undefined,
```

## Getter Rules

Generate getters for all attributes except reserved names:
- Reserved: `node`, `provider`, `dependsOn`, `count`, `forEach`, `lifecycle`, `fqn`, etc.

```typescript
get propertyName(): TokenString {
  return this.getStringAttribute("property_name");
}
```

## Index File

```typescript
export * as provider from "./provider/index.js";
export * as cloudRunService from "./lib/cloud-run-service/index.js";
export * as storageBucket from "./lib/storage-bucket/index.js";
export * as dataCloudRunService from "./lib/data-cloud-run-service/index.js";
```

Namespace names are camelCase versions of the class name.
