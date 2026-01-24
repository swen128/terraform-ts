import type {
  Block,
  ProviderConstraint,
  ProviderSchema,
  ResourceSchema,
  TerraformSchema,
} from "./schema.js";
import {
  attributeTypeToTS,
  generateBlockInterface,
  safeName,
  toPascalCase,
} from "./type-mapper.js";

export interface GeneratedFile {
  path: string;
  content: string;
}

export function generateProviderBindings(
  constraint: ProviderConstraint,
  schema: TerraformSchema,
): GeneratedFile[] {
  const providerFqn = `registry.terraform.io/${constraint.fqn}`;
  const providerSchema = schema.provider_schemas?.[providerFqn];

  if (!providerSchema) {
    const available = Object.keys(schema.provider_schemas ?? {});
    throw new Error(
      `Provider schema not found for ${providerFqn}. Available: ${available.join(", ")}`,
    );
  }

  const files: GeneratedFile[] = [];

  files.push(generateProviderClass(constraint, providerSchema));

  if (providerSchema.resource_schemas) {
    for (const [resourceType, resourceSchema] of Object.entries(providerSchema.resource_schemas)) {
      files.push(generateResourceClass(constraint, resourceType, resourceSchema, false));
    }
  }

  if (providerSchema.data_source_schemas) {
    for (const [dataType, dataSchema] of Object.entries(providerSchema.data_source_schemas)) {
      files.push(generateResourceClass(constraint, dataType, dataSchema, true));
    }
  }

  files.push(generateIndexFile(constraint, providerSchema));

  return files;
}

function generateProviderClass(
  constraint: ProviderConstraint,
  schema: ProviderSchema,
): GeneratedFile {
  const className = `${toPascalCase(constraint.name)}Provider`;
  const configName = `${className}Config`;

  const configProps = generateConfigProperties(schema.provider?.block);

  const content = `import { TerraformProvider } from "../../facade/terraform-provider.js";
import type { Construct } from "../../facade/construct.js";

export interface ${configName} {
  readonly alias?: string;
${configProps}
}

export class ${className} extends TerraformProvider {
  static readonly tfResourceType = "${constraint.fqn}";

  constructor(scope: Construct, id: string, config: ${configName} = {}) {
    super(scope, id, {
      terraformResourceType: "${constraint.fqn}",
      terraformGeneratorMetadata: {
        providerName: "${constraint.name}",
      },
      terraformProviderSource: "${constraint.fqn}",
    });
  }
}
`;

  return {
    path: `providers/${constraint.namespace}/${constraint.name}/provider.ts`,
    content,
  };
}

function generateResourceClass(
  constraint: ProviderConstraint,
  resourceType: string,
  schema: ResourceSchema,
  isDataSource: boolean,
): GeneratedFile {
  const shortName = resourceType.replace(`${constraint.name}_`, "");
  const className = toPascalCase(shortName);
  const prefix = isDataSource ? "Data" : "";
  const fullClassName = `${prefix}${className}`;
  const configName = `${fullClassName}Config`;
  const configProps = generateConfigProperties(schema.block);
  const nestedInterfaces = generateNestedInterfaces(schema.block);

  const baseClass = isDataSource ? "TerraformDataSource" : "TerraformResource";
  const baseImport = isDataSource
    ? 'import { TerraformDataSource } from "../../facade/terraform-data-source.js";'
    : 'import { TerraformResource } from "../../facade/terraform-resource.js";';

  const content = `${baseImport}
import type { Construct } from "../../facade/construct.js";

${nestedInterfaces}

export interface ${configName} {
${configProps}
}

export class ${fullClassName} extends ${baseClass} {
  static readonly tfResourceType = "${resourceType}";

  constructor(scope: Construct, id: string, config: ${configName}) {
    super(scope, id, {
      terraformResourceType: "${resourceType}",
      terraformGeneratorMetadata: {
        providerName: "${constraint.name}",
      },
    });
  }
}
`;

  const folder = isDataSource ? "data-sources" : "resources";
  return {
    path: `providers/${constraint.namespace}/${constraint.name}/${folder}/${shortName}.ts`,
    content,
  };
}

function generateConfigProperties(block: Block | undefined): string {
  if (!block) return "";

  const lines: string[] = [];

  if (block.attributes) {
    for (const [name, attr] of Object.entries(block.attributes)) {
      const tsType = attributeTypeToTS(attr.type);
      const isOptional = !attr.required || attr.optional || attr.computed;
      const optionalMark = isOptional ? "?" : "";
      lines.push(`  readonly ${safeName(name)}${optionalMark}: ${tsType};`);
    }
  }

  if (block.block_types) {
    for (const [name, blockType] of Object.entries(block.block_types)) {
      const interfaceName = toPascalCase(name);
      const isArray = blockType.nesting_mode === "list" || blockType.nesting_mode === "set";
      const isOptional = (blockType.min_items ?? 0) === 0;
      const optionalMark = isOptional ? "?" : "";
      const tsType = isArray ? `${interfaceName}[]` : interfaceName;
      lines.push(`  readonly ${safeName(name)}${optionalMark}: ${tsType};`);
    }
  }

  return lines.join("\n");
}

function generateNestedInterfaces(block: Block): string {
  const interfaces: string[] = [];

  if (block.block_types) {
    for (const [name, blockType] of Object.entries(block.block_types)) {
      interfaces.push(generateBlockInterface(name, blockType.block));
      interfaces.push(generateNestedInterfaces(blockType.block));
    }
  }

  return interfaces.filter(Boolean).join("\n\n");
}

function generateIndexFile(constraint: ProviderConstraint, schema: ProviderSchema): GeneratedFile {
  const exports: string[] = [];

  exports.push(`export * from "./provider.js";`);

  if (schema.resource_schemas) {
    for (const resourceType of Object.keys(schema.resource_schemas)) {
      const shortName = resourceType.replace(`${constraint.name}_`, "");
      exports.push(`export * from "./resources/${shortName}.js";`);
    }
  }

  if (schema.data_source_schemas) {
    for (const dataType of Object.keys(schema.data_source_schemas)) {
      const shortName = dataType.replace(`${constraint.name}_`, "");
      exports.push(`export * from "./data-sources/${shortName}.js";`);
    }
  }

  return {
    path: `providers/${constraint.namespace}/${constraint.name}/index.ts`,
    content: exports.join("\n") + "\n",
  };
}
