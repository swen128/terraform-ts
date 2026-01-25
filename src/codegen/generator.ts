import { err, ok, type Result } from "neverthrow";
import type {
  Attribute,
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

  const resourceFiles = Object.entries(providerSchema.resource_schemas ?? {}).map(
    ([resourceType, resourceSchema]) =>
      generateResourceClass(constraint, resourceType, resourceSchema, false),
  );

  const dataSourceFiles = Object.entries(providerSchema.data_source_schemas ?? {}).map(
    ([dataType, dataSchema]) => generateResourceClass(constraint, dataType, dataSchema, true),
  );

  return ok([
    generateProviderClass(constraint, providerSchema),
    ...resourceFiles,
    ...dataSourceFiles,
    generateIndexFile(constraint, providerSchema),
    generatePackageJson(constraint),
  ]);
}

function generateProviderClass(
  constraint: ProviderConstraint,
  schema: ProviderSchema,
): GeneratedFile {
  const className = `${toPascalCase(constraint.name)}Provider`;
  const configName = `${className}Config`;

  const block = schema.provider?.block;
  const configProps = generateConfigProperties(block);
  const nestedInterfaces = block ? generateNestedInterfaces(block) : "";
  const { privateFields, assignments, synthesizeBody } = generateProviderConfigStorage(block);

  const hasVersion =
    constraint.version !== undefined &&
    constraint.version !== "latest" &&
    constraint.version !== "";
  const versionLine = hasVersion ? `\n        providerVersion: "${constraint.version}",` : "";

  const content = `import { TerraformProvider } from "tfts";
import type { Construct } from "tfts";

${nestedInterfaces}

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
  const configProps = generateConfigProperties(schema.block, fullClassName);
  const nestedInterfaces = generateNestedInterfaces(schema.block, fullClassName);
  const toTerraformFunctions = generateToTerraformFunctions(schema.block, fullClassName);
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
import type { Construct${complexTypeImports}, ${metaArgsImport}, IResolvable } from "tfts";

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
  const attrClasses = Object.entries(block.attributes ?? {}).flatMap(([name, attr]) => {
    if (!isComputedListOfObjects(attr)) return [];

    const blockClassName = toPascalCase(name);
    const outputRefName = `${resourceClassName}${blockClassName}OutputReference`;
    const listName = `${resourceClassName}${blockClassName}List`;
    const fields = extractObjectFieldsFromListType(attr.type);
    if (fields === undefined) return [];

    const getters = generateOutputReferenceGettersFromFields(fields);

    return [
      `export class ${outputRefName} extends ComplexObject {
  constructor(terraformResource: IInterpolatingParent, terraformAttribute: string, complexObjectIndex: number, complexObjectIsFromSet: boolean) {
    super(terraformResource, terraformAttribute, complexObjectIsFromSet, complexObjectIndex);
  }

${getters}
}

export class ${listName} extends ComplexList {
  get(index: number): ${outputRefName} {
    return new ${outputRefName}(this.terraformResource, this.terraformAttribute, index, this.wrapsSet);
  }
}`,
    ];
  });

  const blockClasses = Object.entries(block.block_types ?? {}).flatMap(([name, blockType]) => {
    const blockClassName = toPascalCase(name);
    const outputRefName = `${resourceClassName}${blockClassName}OutputReference`;
    const listName = `${resourceClassName}${blockClassName}List`;
    const isArray = isBlockTypeArray(blockType);

    const getters = generateOutputReferenceGetters(blockType.block);

    const refClass = `export class ${outputRefName} extends ComplexObject {
  constructor(terraformResource: IInterpolatingParent, terraformAttribute: string, complexObjectIndex: number, complexObjectIsFromSet: boolean) {
    super(terraformResource, terraformAttribute, complexObjectIsFromSet, complexObjectIndex);
  }

${getters}
}`;

    const listClass = isArray
      ? `export class ${listName} extends ComplexList {
  get(index: number): ${outputRefName} {
    return new ${outputRefName}(this.terraformResource, this.terraformAttribute, index, this.wrapsSet);
  }
}`
      : null;

    return listClass !== null ? [refClass, listClass] : [refClass];
  });

  return [...attrClasses, ...blockClasses].join("\n\n");
}

function generateOutputReferenceGettersFromFields(fields: Record<string, AttributeType>): string {
  return Object.entries(fields)
    .flatMap(([name, fieldType]) => {
      const camelName = toCamelCase(name.replace(/_/g, "-"));
      const tsType = attributeTypeToTS(fieldType);
      const getter = generateComplexObjectGetter(name, camelName, tsType);
      return getter !== undefined ? [getter] : [];
    })
    .join("\n\n");
}

function generateOutputReferenceGetters(block: Block): string {
  return Object.entries(block.attributes ?? {})
    .flatMap(([name, attr]) => {
      const camelName = toCamelCase(name.replace(/_/g, "-"));
      const tsType = attributeTypeToTS(attr.type);
      const getter = generateComplexObjectGetter(name, camelName, tsType);
      return getter !== undefined ? [getter] : [];
    })
    .join("\n\n");
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
    return `  get ${safePropName}(): IResolvable {
    return this.getBooleanAttribute("${attrName}");
  }`;
  }

  return undefined;
}

function generateComputedBlockGetters(block: Block, resourceClassName: string): string {
  const attrGetters = Object.entries(block.attributes ?? {}).flatMap(([name, attr]) => {
    if (!isComputedListOfObjects(attr)) return [];

    const camelName = toCamelCase(name.replace(/_/g, "-"));
    const blockClassName = toPascalCase(name);
    const listName = `${resourceClassName}${blockClassName}List`;

    return [
      `  private _${camelName}Output = new ${listName}(this, "${name}", false);
  get ${camelName}(): ${listName} {
    return this._${camelName}Output;
  }`,
    ];
  });

  const blockGetters = Object.entries(block.block_types ?? {}).map(([name, blockType]) => {
    const camelName = toCamelCase(name.replace(/_/g, "-"));
    const blockClassName = toPascalCase(name);
    const isArray = isBlockTypeArray(blockType);

    if (isArray) {
      const listName = `${resourceClassName}${blockClassName}List`;
      return `  private _${camelName}Output = new ${listName}(this, "${name}", false);
  get ${camelName}(): ${listName} {
    return this._${camelName}Output;
  }`;
    }
    const outputRefName = `${resourceClassName}${blockClassName}OutputReference`;
    return `  private _${camelName}Output = new ${outputRefName}(this, "${name}", 0, false);
  get ${camelName}(): ${outputRefName} {
    return this._${camelName}Output;
  }`;
  });

  return [...attrGetters, ...blockGetters].join("\n\n");
}

function generateProviderConfigStorage(block: Block | undefined): {
  privateFields: string;
  assignments: string;
  synthesizeBody: string;
} {
  if (block === undefined) {
    return { privateFields: "", assignments: "", synthesizeBody: "" };
  }

  const attrEntries = Object.entries(block.attributes ?? {}).map(([name, attr]) => {
    const tsType = attributeTypeToTS(attr.type);
    const camelPropName = safeCamelName(name);
    const fieldName = `_${camelPropName}`;
    return {
      field: `  private ${fieldName}?: ${tsType};`,
      assign: `    this.${fieldName} = config.${camelPropName};`,
      synth: `      ${name}: this.${fieldName},`,
    };
  });

  const blockEntries = Object.entries(block.block_types ?? {}).map(([name, blockType]) => {
    const interfaceName = toPascalCase(name);
    const isArray = isBlockTypeArray(blockType);
    const camelPropName = safeCamelName(name);
    const fieldName = `_${camelPropName}`;
    const tsType = isArray ? `${interfaceName}[]` : interfaceName;
    return {
      field: `  private ${fieldName}?: ${tsType};`,
      assign: `    this.${fieldName} = config.${camelPropName};`,
      synth: `      ${name}: this.${fieldName},`,
    };
  });

  const allEntries = [...attrEntries, ...blockEntries];
  return {
    privateFields: allEntries.map((e) => e.field).join("\n"),
    assignments: allEntries.map((e) => e.assign).join("\n"),
    synthesizeBody: allEntries.map((e) => e.synth).join("\n"),
  };
}

type ConfigStorageResult = {
  privateFields: string;
  assignments: string;
  synthesizeBody: string;
  configGetters: string;
};

const isConfigurableAttr = (attr: Attribute): boolean =>
  !(attr.computed === true && attr.optional !== true && attr.required !== true);

const RESERVED_FIELD_NAMES = new Set(["id", "scope", "path", "kind", "node", "configId"]);
const RESERVED_GETTER_NAMES = new Set(["kind", "node"]);

function getFieldName(camelPropName: string): string {
  if (RESERVED_FIELD_NAMES.has(camelPropName)) {
    return `_tf${camelPropName.charAt(0).toUpperCase()}${camelPropName.slice(1)}`;
  }
  return `_${camelPropName}`;
}

function isReservedGetterName(name: string): boolean {
  return RESERVED_GETTER_NAMES.has(name);
}

function generateConfigStorage(
  block: Block | undefined,
  resourceClassName: string,
): ConfigStorageResult {
  if (block === undefined) {
    return { privateFields: "", assignments: "", synthesizeBody: "", configGetters: "" };
  }

  const attrEntries = Object.entries(block.attributes ?? {})
    .filter(([, attr]) => isConfigurableAttr(attr) && !isComputedListOfObjects(attr))
    .map(([name, attr]) => {
      const tsType = attributeTypeToTS(attr.type);
      const camelPropName = safeCamelName(name);
      const fieldName = getFieldName(camelPropName);
      return {
        field: `  private ${fieldName}?: ${tsType};`,
        assign: `    this.${fieldName} = config.${camelPropName};`,
        synth: `      ${name}: this.${fieldName},`,
        getter: generateConfigGetter(name, camelPropName, tsType),
      };
    });

  const blockEntries = Object.entries(block.block_types ?? {}).map(([name, blockType]) => {
    const fullTypeName = `${resourceClassName}${toPascalCase(name)}`;
    const isArray = isBlockTypeArray(blockType);
    const camelPropName = safeCamelName(name);
    const fieldName = getFieldName(camelPropName);
    const tsType = isArray ? `${fullTypeName}[]` : fullTypeName;
    const toTerraformFunc = `${fullTypeName}ToTerraform`;
    const synthExpr = isArray
      ? `this.${fieldName}?.map(${toTerraformFunc})`
      : `${toTerraformFunc}(this.${fieldName})`;
    return {
      field: `  private ${fieldName}?: ${tsType};`,
      assign: `    this.${fieldName} = config.${camelPropName};`,
      synth: `      ${name}: ${synthExpr},`,
    };
  });

  return {
    privateFields: [...attrEntries.map((e) => e.field), ...blockEntries.map((e) => e.field)].join(
      "\n",
    ),
    assignments: [...attrEntries.map((e) => e.assign), ...blockEntries.map((e) => e.assign)].join(
      "\n",
    ),
    synthesizeBody: [...attrEntries.map((e) => e.synth), ...blockEntries.map((e) => e.synth)].join(
      "\n",
    ),
    configGetters: attrEntries
      .map((e) => e.getter)
      .filter((g) => g !== undefined)
      .join("\n\n"),
  };
}

function generateConfigGetter(
  attrName: string,
  safePropName: string,
  tsType: string,
): string | undefined {
  if (isReservedGetterName(safePropName)) {
    return undefined;
  }

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
    return `  get ${safePropName}(): IResolvable {
    return this.getBooleanAttribute("${attrName}");
  }`;
  }

  return undefined;
}

function generateComputedGetters(block: Block | undefined): string {
  if (block === undefined) return "";

  return Object.entries(block.attributes ?? {})
    .flatMap(([name, attr]) => {
      if (attr.computed !== true) return [];
      if (isComputedListOfObjects(attr)) return [];
      if (isConfigurableAttr(attr)) return [];

      const camelPropName = safeCamelName(name);
      const tsType = attributeTypeToTS(attr.type);
      const getter = generateGetterForType(name, camelPropName, tsType);
      return getter !== undefined ? [getter] : [];
    })
    .join("\n\n");
}

function generateGetterForType(
  attrName: string,
  safePropName: string,
  tsType: string,
): string | undefined {
  if (isReservedGetterName(safePropName)) {
    return undefined;
  }

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
    return `  get ${safePropName}(): IResolvable {
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

function generateConfigProperties(block: Block | undefined, resourcePrefix: string = ""): string {
  if (block === undefined) return "";

  const attrLines = Object.entries(block.attributes ?? {}).flatMap(([name, attr]) => {
    if (isComputedListOfObjects(attr)) return [];

    const tsType = attributeTypeToTS(attr.type);
    const isOptional = attr.required !== true || attr.optional === true || attr.computed === true;
    const optionalMark = isOptional ? "?" : "";
    return [`  readonly ${safeCamelName(name)}${optionalMark}: ${tsType};`];
  });

  const blockLines = Object.entries(block.block_types ?? {}).map(([name, blockType]) => {
    const fullTypeName = resourcePrefix
      ? `${resourcePrefix}${toPascalCase(name)}`
      : toPascalCase(name);
    const isArray = isBlockTypeArray(blockType);
    const isOptional = (blockType.min_items ?? 0) === 0;
    const optionalMark = isOptional ? "?" : "";
    const tsType = isArray ? `${fullTypeName}[]` : fullTypeName;
    return `  readonly ${safeCamelName(name)}${optionalMark}: ${tsType};`;
  });

  return [...attrLines, ...blockLines].join("\n");
}

function generateNestedInterfaces(block: Block, prefix: string = ""): string {
  return Object.entries(block.block_types ?? {})
    .flatMap(([name, blockType]) => {
      const fullName = prefix ? `${prefix}_${name}` : name;
      return [
        generateBlockInterface(name, blockType.block, prefix),
        generateNestedInterfaces(blockType.block, fullName),
      ];
    })
    .filter(Boolean)
    .join("\n\n");
}

function generateToTerraformFunctions(block: Block, prefix: string = ""): string {
  return Object.entries(block.block_types ?? {})
    .flatMap(([name, blockType]) => {
      const funcPrefix = prefix ? `${prefix}${toPascalCase(name)}` : safeCamelName(name);
      return [
        generateSingleToTerraformFunction(name, blockType.block, funcPrefix),
        generateToTerraformFunctions(blockType.block, funcPrefix),
      ];
    })
    .filter(Boolean)
    .join("\n\n");
}

function generateSingleToTerraformFunction(
  _name: string,
  block: Block,
  funcPrefix: string,
): string {
  const funcName = `${funcPrefix}ToTerraform`;
  const typeName = funcPrefix.charAt(0).toUpperCase() + funcPrefix.slice(1);

  const attrLines = Object.entries(block.attributes ?? {}).flatMap(([attrName, attr]) => {
    if (attr.computed === true && attr.optional !== true && attr.required !== true) {
      return [];
    }
    const camelAttrName = safeCamelName(attrName);
    return [`    ${attrName}: config?.${camelAttrName},`];
  });

  const blockLines = Object.entries(block.block_types ?? {}).map(([blockName, blockType]) => {
    const camelBlockName = safeCamelName(blockName);
    const nestedFuncPrefix = `${funcPrefix}${toPascalCase(blockName)}`;
    const nestedFuncName = `${nestedFuncPrefix}ToTerraform`;
    const isArray = isBlockTypeArray(blockType);

    return isArray
      ? `    ${blockName}: config?.${camelBlockName}?.map(${nestedFuncName}),`
      : `    ${blockName}: ${nestedFuncName}(config?.${camelBlockName}),`;
  });

  const body = [...attrLines, ...blockLines].join("\n");

  return `function ${funcName}(config: ${typeName} | undefined): Record<string, unknown> | undefined {
  if (config === undefined) return undefined;
  return {
${body}
  };
}`;
}

function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function generateIndexFile(constraint: ProviderConstraint, schema: ProviderSchema): GeneratedFile {
  const resourceExports = Object.keys(schema.resource_schemas ?? {}).map((resourceType) => {
    const shortName = resourceType.replace(`${constraint.name}_`, "");
    const kebabName = shortName.replace(/_/g, "-");
    const camelName = toCamelCase(kebabName);
    return `export * as ${camelName} from "./lib/${kebabName}/index.js";`;
  });

  const dataExports = Object.keys(schema.data_source_schemas ?? {}).map((dataType) => {
    const shortName = dataType.replace(`${constraint.name}_`, "");
    const kebabName = shortName.replace(/_/g, "-");
    const camelName = `data${constraint.name.charAt(0).toUpperCase() + constraint.name.slice(1)}${toPascalCase(shortName)}`;
    return `export * as ${camelName} from "./lib/data-${constraint.name}-${kebabName}/index.js";`;
  });

  const exports = [`export * from "./lib/provider/index.js";`, ...resourceExports, ...dataExports];

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
