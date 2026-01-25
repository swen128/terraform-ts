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
  safeCamelName,
  toPascalCase,
} from "./type-mapper.js";

function isComputedOnlyBlock(block: Block): boolean {
  const hasAttributes = block.attributes !== undefined && Object.keys(block.attributes).length > 0;
  const hasBlockTypes =
    block.block_types !== undefined && Object.keys(block.block_types).length > 0;

  // Empty blocks are valid config options (e.g., bigquery_profile: {})
  if (!hasAttributes && !hasBlockTypes) {
    return false;
  }

  if (hasAttributes) {
    for (const attr of Object.values(block.attributes ?? {})) {
      if (attr.required === true || attr.optional === true) {
        return false;
      }
    }
  }
  if (hasBlockTypes) {
    for (const blockType of Object.values(block.block_types ?? {})) {
      if (!isComputedOnlyBlock(blockType.block)) {
        return false;
      }
    }
  }
  return true;
}

function isBlockTypeArray(blockType: { nesting_mode: string; max_items?: number }): boolean {
  const isListOrSet = blockType.nesting_mode === "list" || blockType.nesting_mode === "set";
  return isListOrSet && blockType.max_items !== 1;
}

type AttributeType =
  | "string"
  | "number"
  | "bool"
  | "dynamic"
  | ["list", AttributeType]
  | ["set", AttributeType]
  | ["map", AttributeType]
  | ["object", Record<string, AttributeType>]
  | ["tuple", AttributeType[]];

function isComputedListOfObjects(attr: {
  type?: AttributeType;
  computed?: boolean;
  required?: boolean;
  optional?: boolean;
}): boolean {
  if (attr.computed !== true) return false;
  if (attr.required === true || attr.optional === true) return false;
  if (attr.type === undefined) return false;
  if (!Array.isArray(attr.type)) return false;
  if (attr.type[0] !== "list") return false;
  const inner = attr.type[1];
  if (!Array.isArray(inner)) return false;
  if (inner[0] !== "object") return false;
  return true;
}

function extractObjectFieldsFromListType(
  type: AttributeType | undefined,
): Record<string, AttributeType> | undefined {
  if (type === undefined) return undefined;
  if (!Array.isArray(type)) return undefined;
  if (type[0] !== "list") return undefined;
  const inner = type[1];
  if (!Array.isArray(inner)) return undefined;
  if (inner[0] !== "object") return undefined;
  return inner[1];
}

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
  files.push(generatePackageJson(constraint));

  return ok(files);
}

function generateProviderClass(
  constraint: ProviderConstraint,
  schema: ProviderSchema,
): GeneratedFile {
  const className = `${toPascalCase(constraint.name)}Provider`;
  const configName = `${className}Config`;

  const configProps = generateConfigProperties(schema.provider?.block);
  const { privateFields, assignments, synthesizeBody } = generateProviderConfigStorage(
    schema.provider?.block,
  );

  const hasVersion =
    constraint.version !== undefined &&
    constraint.version !== "latest" &&
    constraint.version !== "";
  const versionLine = hasVersion ? `\n        providerVersion: "${constraint.version}",` : "";

  const content = `import { TerraformProvider } from "tfts";
import type { Construct } from "tfts";

export type ${configName} = {
  readonly alias?: string;
${configProps}
};

export class ${className} extends TerraformProvider {
  static readonly tfResourceType = "${constraint.name}";

${privateFields}

  constructor(scope: Construct, id: string, config: ${configName} = {}) {
    super(scope, id, {
      terraformResourceType: "${constraint.name}",
      terraformGeneratorMetadata: {
        providerName: "${constraint.name}",${versionLine}
      },
      terraformProviderSource: "${constraint.fqn}",
      alias: config.alias,
    });
${assignments}
  }

  protected override synthesizeAttributes(): Record<string, unknown> {
    return {
${synthesizeBody}
    };
  }
}
`;

  return {
    path: `providers/${constraint.namespace}/${constraint.name}/lib/provider/index.ts`,
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
  const className = isDataSource ? toPascalCase(resourceType) : toPascalCase(shortName);
  const prefix = isDataSource ? "Data" : "";
  const fullClassName = `${prefix}${className}`;
  const configName = `${fullClassName}Config`;
  const configProps = generateConfigProperties(schema.block);
  const nestedInterfaces = generateNestedInterfaces(schema.block);
  const toTerraformFunctions = generateToTerraformFunctions(schema.block);
  const complexClasses = generateComplexClasses(schema.block, className);
  const hasComplexClasses = complexClasses.length > 0;

  const baseClass = isDataSource ? "TerraformDataSource" : "TerraformResource";
  const baseImport = isDataSource ? "TerraformDataSource" : "TerraformResource";
  const complexImports = hasComplexClasses ? ", ComplexList, ComplexObject" : "";

  const { privateFields, assignments, synthesizeBody, configGetters } = generateConfigStorage(
    schema.block,
    className,
  );
  const computedGetters = generateComputedGetters(schema.block);
  const computedBlockGetters = generateComputedBlockGetters(schema.block, className);

  const complexTypeImports = hasComplexClasses ? ", IInterpolatingParent" : "";
  const metaArgsImport = isDataSource
    ? "TerraformDataSourceMetaArguments"
    : "TerraformMetaArguments";
  const content = `import { ${baseImport}${complexImports} } from "tfts";
import type { Construct${complexTypeImports}, ${metaArgsImport} } from "tfts";

${nestedInterfaces}

${toTerraformFunctions}

${complexClasses}

export type ${configName} = ${metaArgsImport} & {
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
      dependsOn: config.dependsOn,
      count: config.count,
      provider: config.provider,${isDataSource ? "" : "\n      lifecycle: config.lifecycle,"}
      forEach: config.forEach,
    });
${assignments}
  }

${configGetters}

${computedGetters}

${computedBlockGetters}

  protected override synthesizeAttributes(): Record<string, unknown> {
    return {
${synthesizeBody}
    };
  }
}
`;

  const kebabName = shortName.replace(/_/g, "-");
  const pathPrefix = isDataSource ? `data-${constraint.name}-` : "";
  return {
    path: `providers/${constraint.namespace}/${constraint.name}/lib/${pathPrefix}${kebabName}/index.ts`,
    content,
  };
}

function generateComplexClasses(block: Block, resourceClassName: string): string {
  const classes: string[] = [];

  if (block.attributes !== undefined) {
    for (const [name, attr] of Object.entries(block.attributes)) {
      if (!isComputedListOfObjects(attr)) continue;

      const blockClassName = toPascalCase(name);
      const outputRefName = `${resourceClassName}${blockClassName}OutputReference`;
      const listName = `${resourceClassName}${blockClassName}List`;
      const fields = extractObjectFieldsFromListType(attr.type);
      if (fields === undefined) continue;

      const getters = generateOutputReferenceGettersFromFields(fields);

      classes.push(`export class ${outputRefName} extends ComplexObject {
  constructor(terraformResource: IInterpolatingParent, terraformAttribute: string, complexObjectIndex: number, complexObjectIsFromSet: boolean) {
    super(terraformResource, terraformAttribute, complexObjectIsFromSet, complexObjectIndex);
  }

${getters}
}

export class ${listName} extends ComplexList {
  get(index: number): ${outputRefName} {
    return new ${outputRefName}(this.terraformResource, this.terraformAttribute, index, true);
  }
}`);
    }
  }

  if (block.block_types !== undefined) {
    for (const [name, blockType] of Object.entries(block.block_types)) {
      const blockClassName = toPascalCase(name);
      const outputRefName = `${resourceClassName}${blockClassName}OutputReference`;
      const listName = `${resourceClassName}${blockClassName}List`;
      const isArray = isBlockTypeArray(blockType);

      const getters = generateOutputReferenceGetters(blockType.block);

      classes.push(`export class ${outputRefName} extends ComplexObject {
  constructor(terraformResource: IInterpolatingParent, terraformAttribute: string, complexObjectIndex: number, complexObjectIsFromSet: boolean) {
    super(terraformResource, terraformAttribute, complexObjectIsFromSet, complexObjectIndex);
  }

${getters}
}`);

      if (isArray) {
        classes.push(`export class ${listName} extends ComplexList {
  get(index: number): ${outputRefName} {
    return new ${outputRefName}(this.terraformResource, this.terraformAttribute, index, true);
  }
}`);
      }
    }
  }

  return classes.join("\n\n");
}

function generateOutputReferenceGettersFromFields(fields: Record<string, AttributeType>): string {
  const getters: string[] = [];

  for (const [name, fieldType] of Object.entries(fields)) {
    const camelName = toCamelCase(name.replace(/_/g, "-"));
    const tsType = attributeTypeToTS(fieldType);
    const getter = generateComplexObjectGetter(name, camelName, tsType);
    if (getter !== undefined) {
      getters.push(getter);
    }
  }

  return getters.join("\n\n");
}

function generateOutputReferenceGetters(block: Block): string {
  const getters: string[] = [];

  if (block.attributes !== undefined) {
    for (const [name, attr] of Object.entries(block.attributes)) {
      const camelName = toCamelCase(name.replace(/_/g, "-"));
      const tsType = attributeTypeToTS(attr.type);
      const getter = generateComplexObjectGetter(name, camelName, tsType);
      if (getter !== undefined) {
        getters.push(getter);
      }
    }
  }

  return getters.join("\n\n");
}

function generateComplexObjectGetter(
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

  return undefined;
}

function generateComputedBlockGetters(block: Block, resourceClassName: string): string {
  const getters: string[] = [];

  if (block.attributes !== undefined) {
    for (const [name, attr] of Object.entries(block.attributes)) {
      if (!isComputedListOfObjects(attr)) continue;

      const camelName = toCamelCase(name.replace(/_/g, "-"));
      const blockClassName = toPascalCase(name);
      const listName = `${resourceClassName}${blockClassName}List`;

      getters.push(`  private _${camelName}Output = new ${listName}(this, "${name}", false);
  get ${camelName}(): ${listName} {
    return this._${camelName}Output;
  }`);
    }
  }

  if (block.block_types !== undefined) {
    for (const [name, blockType] of Object.entries(block.block_types)) {
      const camelName = toCamelCase(name.replace(/_/g, "-"));
      const blockClassName = toPascalCase(name);
      const isArray = isBlockTypeArray(blockType);

      if (isArray) {
        const listName = `${resourceClassName}${blockClassName}List`;
        getters.push(`  private _${camelName}Output = new ${listName}(this, "${name}", false);
  get ${camelName}(): ${listName} {
    return this._${camelName}Output;
  }`);
      } else {
        const outputRefName = `${resourceClassName}${blockClassName}OutputReference`;
        getters.push(`  private _${camelName}Output = new ${outputRefName}(this, "${name}", 0, false);
  get ${camelName}(): ${outputRefName} {
    return this._${camelName}Output;
  }`);
      }
    }
  }

  return getters.join("\n\n");
}

function generateProviderConfigStorage(block: Block | undefined): {
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
      const tsType = attributeTypeToTS(attr.type);
      const camelPropName = safeCamelName(name);
      const fieldName = `_${camelPropName}`;

      fields.push(`  private ${fieldName}?: ${tsType};`);
      assigns.push(`    this.${fieldName} = config.${camelPropName};`);
      synth.push(`      ${name}: this.${fieldName},`);
    }
  }

  if (block.block_types !== undefined) {
    for (const [name, blockType] of Object.entries(block.block_types)) {
      const interfaceName = toPascalCase(name);
      const isArray = isBlockTypeArray(blockType);
      const camelPropName = safeCamelName(name);
      const fieldName = `_${camelPropName}`;
      const tsType = isArray ? `${interfaceName}[]` : interfaceName;

      fields.push(`  private ${fieldName}?: ${tsType};`);
      assigns.push(`    this.${fieldName} = config.${camelPropName};`);
      synth.push(`      ${name}: this.${fieldName},`);
    }
  }

  return {
    privateFields: fields.join("\n"),
    assignments: assigns.join("\n"),
    synthesizeBody: synth.join("\n"),
  };
}

function generateConfigStorage(
  block: Block | undefined,
  _resourceClassName: string,
): {
  privateFields: string;
  assignments: string;
  synthesizeBody: string;
  configGetters: string;
} {
  if (block === undefined) {
    return { privateFields: "", assignments: "", synthesizeBody: "", configGetters: "" };
  }

  const fields: string[] = [];
  const assigns: string[] = [];
  const synth: string[] = [];
  const getters: string[] = [];

  if (block.attributes !== undefined) {
    for (const [name, attr] of Object.entries(block.attributes)) {
      if (attr.computed === true && attr.optional !== true && attr.required !== true) {
        continue;
      }
      if (isComputedListOfObjects(attr)) continue;

      const tsType = attributeTypeToTS(attr.type);
      const camelPropName = safeCamelName(name);
      const fieldName = `_${camelPropName}`;

      fields.push(`  private ${fieldName}?: ${tsType};`);
      assigns.push(`    this.${fieldName} = config.${camelPropName};`);
      synth.push(`      ${name}: this.${fieldName},`);

      const getter = generateConfigGetter(name, camelPropName, tsType);
      if (getter !== undefined) {
        getters.push(getter);
      }
    }
  }

  if (block.block_types !== undefined) {
    for (const [name, blockType] of Object.entries(block.block_types)) {
      if (isComputedOnlyBlock(blockType.block)) continue;

      const interfaceName = toPascalCase(name);
      const isArray = isBlockTypeArray(blockType);
      const camelPropName = safeCamelName(name);
      const fieldName = `_${camelPropName}`;
      const tsType = isArray ? `${interfaceName}[]` : interfaceName;
      const toTerraformFunc = `${camelPropName}ToTerraform`;

      fields.push(`  private ${fieldName}?: ${tsType};`);
      assigns.push(`    this.${fieldName} = config.${camelPropName};`);
      if (isArray) {
        synth.push(`      ${name}: this.${fieldName}?.map(${toTerraformFunc}),`);
      } else {
        synth.push(`      ${name}: ${toTerraformFunc}(this.${fieldName}),`);
      }
    }
  }

  return {
    privateFields: fields.join("\n"),
    assignments: assigns.join("\n"),
    synthesizeBody: synth.join("\n"),
    configGetters: getters.join("\n\n"),
  };
}

function generateConfigGetter(
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

  return undefined;
}

function generateComputedGetters(block: Block | undefined): string {
  if (block === undefined) return "";

  const getters: string[] = [];

  if (block.attributes !== undefined) {
    for (const [name, attr] of Object.entries(block.attributes)) {
      if (attr.computed !== true) continue;
      if (isComputedListOfObjects(attr)) continue;

      const camelPropName = safeCamelName(name);
      const tsType = attributeTypeToTS(attr.type);
      const getter = generateGetterForType(name, camelPropName, tsType);
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
      if (isComputedListOfObjects(attr)) continue;

      const tsType = attributeTypeToTS(attr.type);
      const isOptional = attr.required !== true || attr.optional === true || attr.computed === true;
      const optionalMark = isOptional ? "?" : "";
      lines.push(`  readonly ${safeCamelName(name)}${optionalMark}: ${tsType};`);
    }
  }

  if (block.block_types) {
    for (const [name, blockType] of Object.entries(block.block_types)) {
      if (isComputedOnlyBlock(blockType.block)) continue;

      const interfaceName = toPascalCase(name);
      const isArray = isBlockTypeArray(blockType);
      const isOptional = (blockType.min_items ?? 0) === 0;
      const optionalMark = isOptional ? "?" : "";
      const tsType = isArray ? `${interfaceName}[]` : interfaceName;
      lines.push(`  readonly ${safeCamelName(name)}${optionalMark}: ${tsType};`);
    }
  }

  return lines.join("\n");
}

function generateNestedInterfaces(block: Block): string {
  const interfaces: string[] = [];

  if (block.block_types) {
    for (const [name, blockType] of Object.entries(block.block_types)) {
      if (isComputedOnlyBlock(blockType.block)) continue;

      interfaces.push(generateBlockInterface(name, blockType.block));
      interfaces.push(generateNestedInterfaces(blockType.block));
    }
  }

  return interfaces.filter(Boolean).join("\n\n");
}

function generateToTerraformFunctions(block: Block, prefix: string = ""): string {
  const functions: string[] = [];

  if (block.block_types) {
    for (const [name, blockType] of Object.entries(block.block_types)) {
      if (isComputedOnlyBlock(blockType.block)) continue;

      const funcPrefix = prefix ? `${prefix}${toPascalCase(name)}` : safeCamelName(name);
      functions.push(generateSingleToTerraformFunction(name, blockType.block, funcPrefix));
      functions.push(generateToTerraformFunctions(blockType.block, funcPrefix));
    }
  }

  return functions.filter(Boolean).join("\n\n");
}

function generateSingleToTerraformFunction(name: string, block: Block, funcPrefix: string): string {
  const funcName = `${funcPrefix}ToTerraform`;
  const typeName = toPascalCase(name);
  const body: string[] = [];

  if (block.attributes) {
    for (const [attrName, attr] of Object.entries(block.attributes)) {
      if (attr.computed === true && attr.optional !== true && attr.required !== true) {
        continue;
      }
      const camelAttrName = safeCamelName(attrName);
      body.push(`    ${attrName}: config?.${camelAttrName},`);
    }
  }

  if (block.block_types) {
    for (const [blockName, blockType] of Object.entries(block.block_types)) {
      if (isComputedOnlyBlock(blockType.block)) continue;

      const camelBlockName = safeCamelName(blockName);
      const nestedFuncPrefix = `${funcPrefix}${toPascalCase(blockName)}`;
      const nestedFuncName = `${nestedFuncPrefix}ToTerraform`;
      const isArray = isBlockTypeArray(blockType);

      if (isArray) {
        body.push(`    ${blockName}: config?.${camelBlockName}?.map(${nestedFuncName}),`);
      } else {
        body.push(`    ${blockName}: ${nestedFuncName}(config?.${camelBlockName}),`);
      }
    }
  }

  return `function ${funcName}(config: ${typeName} | undefined): Record<string, unknown> | undefined {
  if (config === undefined) return undefined;
  return {
${body.join("\n")}
  };
}`;
}

function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function generateIndexFile(constraint: ProviderConstraint, schema: ProviderSchema): GeneratedFile {
  const exports: string[] = [];

  exports.push(`export * from "./lib/provider/index.js";`);

  if (schema.resource_schemas) {
    for (const resourceType of Object.keys(schema.resource_schemas)) {
      const shortName = resourceType.replace(`${constraint.name}_`, "");
      const kebabName = shortName.replace(/_/g, "-");
      const camelName = toCamelCase(kebabName);
      exports.push(`export * as ${camelName} from "./lib/${kebabName}/index.js";`);
    }
  }

  if (schema.data_source_schemas) {
    for (const dataType of Object.keys(schema.data_source_schemas)) {
      const shortName = dataType.replace(`${constraint.name}_`, "");
      const kebabName = shortName.replace(/_/g, "-");
      const camelName = `data${constraint.name.charAt(0).toUpperCase() + constraint.name.slice(1)}${toPascalCase(shortName)}`;
      exports.push(
        `export * as ${camelName} from "./lib/data-${constraint.name}-${kebabName}/index.js";`,
      );
    }
  }

  return {
    path: `providers/${constraint.namespace}/${constraint.name}/index.ts`,
    content: exports.join("\n") + "\n",
  };
}

function generatePackageJson(constraint: ProviderConstraint): GeneratedFile {
  const content = JSON.stringify(
    {
      name: `@cdktf/provider-${constraint.name}`,
      version: "0.0.0",
      main: "./index.ts",
      types: "./index.ts",
      exports: {
        ".": "./index.ts",
        "./lib/*": "./lib/*/index.ts",
      },
    },
    null,
    2,
  );

  return {
    path: `providers/${constraint.namespace}/${constraint.name}/package.json`,
    content: content + "\n",
  };
}
