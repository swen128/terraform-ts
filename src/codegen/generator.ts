import { err, ok, type Result } from "neverthrow";
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

export type GeneratedFile = {
  path: string;
  content: string;
};

export function generateProviderBindings(
  constraint: ProviderConstraint,
  schema: TerraformSchema,
): Result<GeneratedFile[], Error> {
  const providerFqn = `registry.terraform.io/${constraint.fqn}`;
  const providerSchema = schema.provider_schemas?.[providerFqn];

  if (providerSchema === undefined) {
    const available = Object.keys(schema.provider_schemas ?? {});
    return err(
      new Error(`Provider schema not found for ${providerFqn}. Available: ${available.join(", ")}`),
    );
  }

  const files: GeneratedFile[] = [];

  files.push(generateProviderClass(constraint, providerSchema));

  if (providerSchema.resource_schemas !== undefined) {
    for (const [resourceType, resourceSchema] of Object.entries(providerSchema.resource_schemas)) {
      files.push(generateResourceClass(constraint, resourceType, resourceSchema, false));
    }
  }

  if (providerSchema.data_source_schemas !== undefined) {
    for (const [dataType, dataSchema] of Object.entries(providerSchema.data_source_schemas)) {
      files.push(generateResourceClass(constraint, dataType, dataSchema, true));
    }
  }

  files.push(generateIndexFile(constraint, providerSchema));

  return ok(files);
}

function generateProviderClass(
  constraint: ProviderConstraint,
  schema: ProviderSchema,
): GeneratedFile {
  const className = `${toPascalCase(constraint.name)}Provider`;
  const configName = `${className}Config`;

  const configProps = generateConfigProperties(schema.provider?.block);

  const content = `import { TerraformProvider } from "tfts";
import type { Construct } from "tfts";

export type ${configName} = {
  readonly alias?: string;
${configProps}
};

export class ${className} extends TerraformProvider {
  static readonly tfResourceType = "${constraint.name}";

  constructor(scope: Construct, id: string, config: ${configName} = {}) {
    super(scope, id, {
      terraformResourceType: "${constraint.name}",
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
    ? `import { TerraformDataSource } from "tfts";`
    : `import { TerraformResource } from "tfts";`;

  const { privateFields, assignments, synthesizeBody } = generateConfigStorage(schema.block);
  const computedGetters = generateComputedGetters(schema.block);

  const content = `${baseImport}
import type { Construct } from "tfts";

${nestedInterfaces}

export type ${configName} = {
${configProps}
};

export class ${fullClassName} extends ${baseClass} {
  static readonly tfResourceType = "${resourceType}";

${privateFields}

  constructor(scope: Construct, id: string, config: ${configName}) {
    super(scope, id, {
      terraformResourceType: "${resourceType}",
      terraformGeneratorMetadata: {
        providerName: "${constraint.name}",
      },
    });
${assignments}
  }

${computedGetters}

  protected override synthesizeAttributes(): Record<string, unknown> {
    return {
${synthesizeBody}
    };
  }
}
`;

  const folder = isDataSource ? "data-sources" : "resources";
  return {
    path: `providers/${constraint.namespace}/${constraint.name}/${folder}/${shortName}.ts`,
    content,
  };
}

function generateConfigStorage(block: Block | undefined): {
  privateFields: string;
  assignments: string;
  synthesizeBody: string;
} {
  if (block === undefined) {
    return { privateFields: "", assignments: "", synthesizeBody: "" };
  }

  const fields: string[] = [];
  const assigns: string[] = [];
  const synth: string[] = [];

  if (block.attributes !== undefined) {
    for (const [name, attr] of Object.entries(block.attributes)) {
      // Skip computed-only attributes (they're outputs, not inputs)
      if (attr.computed === true && attr.optional !== true && attr.required !== true) {
        continue;
      }

      const tsType = attributeTypeToTS(attr.type);
      const safePropName = safeName(name);
      const fieldName = `_${safePropName}`;

      fields.push(`  private ${fieldName}?: ${tsType};`);
      assigns.push(`    this.${fieldName} = config.${safePropName};`);
      synth.push(`      ${name}: this.${fieldName},`);
    }
  }

  if (block.block_types !== undefined) {
    for (const [name, blockType] of Object.entries(block.block_types)) {
      const interfaceName = toPascalCase(name);
      const isArray = blockType.nesting_mode === "list" || blockType.nesting_mode === "set";
      const safePropName = safeName(name);
      const fieldName = `_${safePropName}`;
      const tsType = isArray ? `${interfaceName}[]` : interfaceName;

      fields.push(`  private ${fieldName}?: ${tsType};`);
      assigns.push(`    this.${fieldName} = config.${safePropName};`);
      synth.push(`      ${name}: this.${fieldName},`);
    }
  }

  return {
    privateFields: fields.join("\n"),
    assignments: assigns.join("\n"),
    synthesizeBody: synth.join("\n"),
  };
}

function generateComputedGetters(block: Block | undefined): string {
  if (block === undefined) return "";

  const getters: string[] = [];

  if (block.attributes !== undefined) {
    for (const [name, attr] of Object.entries(block.attributes)) {
      if (attr.computed !== true) continue;

      const safePropName = safeName(name);
      const tsType = attributeTypeToTS(attr.type);
      const getter = generateGetterForType(name, safePropName, tsType);
      if (getter !== undefined) {
        getters.push(getter);
      }
    }
  }

  return getters.join("\n\n");
}

function generateGetterForType(
  attrName: string,
  safePropName: string,
  tsType: string,
): string | undefined {
  const stringTypes = new Set(["string", "string | undefined"]);
  const numberTypes = new Set(["number", "number | undefined"]);
  const booleanTypes = new Set(["boolean", "boolean | undefined"]);

  if (stringTypes.has(tsType)) {
    return `  get ${safePropName}(): string {
    return this.getStringAttribute("${attrName}");
  }`;
  }

  if (numberTypes.has(tsType)) {
    return `  get ${safePropName}(): number {
    return this.getNumberAttribute("${attrName}");
  }`;
  }

  if (booleanTypes.has(tsType)) {
    return `  get ${safePropName}(): boolean {
    return this.getBooleanAttribute("${attrName}");
  }`;
  }

  if (tsType.endsWith("[]")) {
    return `  get ${safePropName}(): string[] {
    return this.getListAttribute("${attrName}");
  }`;
  }

  if (tsType.startsWith("Record<string,")) {
    return `  get ${safePropName}(): Record<string, string> {
    return this.getStringMapAttribute("${attrName}");
  }`;
  }

  return undefined;
}

function generateConfigProperties(block: Block | undefined): string {
  if (block === undefined) return "";

  const lines: string[] = [];

  if (block.attributes !== undefined) {
    for (const [name, attr] of Object.entries(block.attributes)) {
      const tsType = attributeTypeToTS(attr.type);
      const isOptional = attr.required !== true || attr.optional === true || attr.computed === true;
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
