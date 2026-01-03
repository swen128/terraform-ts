import type { ProviderSchema, ResourceSchema, SchemaBlock } from "./schema.js";
import { parseSchemaType } from "./schema.js";
import {
  resourceTemplate,
  providerTemplate,
  dataSourceTemplate,
  configInterfaceTemplate,
  indexTemplate,
  type AttributeGetter,
  type PropMapping,
} from "./templates.js";

const IMPORTS = `import type { TerraformStack, TokenString, TerraformResourceConfig, TerraformDataSourceConfig, TerraformProviderConfig, TfString, TfNumber, TfBoolean, TfStringList, TfNumberList, TfStringMap } from "tfts";
import { TerraformProvider, TerraformResource, TerraformDataSource } from "tfts";`;

// Properties defined in base classes that cannot be overridden
const RESERVED_NAMES = new Set([
  "node",
  "path",
  "terraformResourceType",
  "friendlyUniqueId",
  "terraformGeneratorMetadata",
  "connection",
  "count",
  "dependsOn",
  "forEach",
  "lifecycle",
  "provider",
  "provisioners",
  "fqn",
]);

export const generateProvider = (name: string, schema: ProviderSchema): string => {
  const entries = Object.entries(schema.provider_schemas);
  if (entries.length === 0) {
    return `// No schema available for provider ${name}\nexport {};\n`;
  }

  const firstEntry = entries[0];
  if (firstEntry === undefined) {
    return `// No schema available for provider ${name}\nexport {};\n`;
  }

  const [source, entry] = firstEntry;
  const providerName = toPascalCase(name);

  const parts: string[] = [IMPORTS];

  // Provider class
  const providerConfig = generateConfigWithNestedTypes(
    `${providerName}Config`,
    entry.provider,
    "TerraformProviderConfig",
  );
  const providerClass = providerTemplate(providerName, source, providerConfig.props);
  parts.push(...providerConfig.types);
  parts.push(providerClass);

  // Resources
  for (const [resourceName, resourceSchema] of Object.entries(entry.resource_schemas ?? {})) {
    const className = resourceNameToClassName(resourceName);
    const config = generateConfigWithNestedTypes(
      `${className}Config`,
      resourceSchema.block,
      "TerraformResourceConfig",
    );
    const resourceClass = resourceTemplate(className, resourceName, config.props, config.getters);
    parts.push(...config.types);
    parts.push(resourceClass);
  }

  // Data sources
  for (const [dataSourceName, dataSourceSchema] of Object.entries(
    entry.data_source_schemas ?? {},
  )) {
    const className = `Data${resourceNameToClassName(dataSourceName)}`;
    const config = generateConfigWithNestedTypes(
      `${className}Config`,
      dataSourceSchema.block,
      "TerraformDataSourceConfig",
    );
    const dataSourceClass = dataSourceTemplate(
      className,
      dataSourceName,
      config.props,
      config.getters,
    );
    parts.push(...config.types);
    parts.push(dataSourceClass);
  }

  return parts.join("\n\n");
};

export const generateResource = (name: string, schema: ResourceSchema): string => {
  const className = resourceNameToClassName(name);
  const config = generateConfigInterface(`${className}Config`, schema.block);
  return `${config.code}\n\n${resourceTemplate(className, name, config.props)}`;
};

export const generateDataSource = (name: string, schema: ResourceSchema): string => {
  const className = `Data${resourceNameToClassName(name)}`;
  const config = generateConfigInterface(`${className}Config`, schema.block);
  return `${config.code}\n\n${dataSourceTemplate(className, name, config.props)}`;
};

export const generateConfig = (name: string, schema: SchemaBlock): string => {
  return generateConfigInterface(name, schema).code;
};

export const generateIndex = (
  resources: readonly string[],
  dataSources: readonly string[],
): string => {
  return indexTemplate(resources, dataSources);
};

type ConfigResult = {
  readonly code: string;
  readonly props: readonly PropMapping[];
};

type ConfigWithNestedResult = {
  readonly types: readonly string[];
  readonly props: readonly PropMapping[];
  readonly getters: readonly AttributeGetter[];
};

const generateConfigInterface = (name: string, block: SchemaBlock): ConfigResult => {
  const attrEntries = Object.entries(block.attributes ?? {});
  const blockEntries = Object.entries(block.block_types ?? {});

  const attrProps: PropMapping[] = attrEntries.map(([attrName]) => ({
    tfName: toTfName(attrName),
    tsName: toCamelCase(attrName),
  }));
  const attrLines = attrEntries.map(([attrName, attr]) => {
    const tsType = parseSchemaType(attr.type);
    const optional = attr.optional === true || attr.computed === true;
    const propName = toCamelCase(attrName);
    return `  readonly ${propName}${optional ? "?" : ""}: ${tsType};`;
  });

  const blockProps: PropMapping[] = blockEntries.map(([blockName]) => ({
    tfName: toTfName(blockName),
    tsName: toCamelCase(blockName),
  }));
  const blockLines = blockEntries.map(([blockName, blockType]) => {
    const nestedName = `${name}${toPascalCase(blockName)}`;
    const propName = toCamelCase(blockName);
    const isList = blockType.nesting_mode === "list" || blockType.nesting_mode === "set";
    const isOptional = blockType.min_items === undefined || blockType.min_items === 0;
    return isList
      ? `  readonly ${propName}${isOptional ? "?" : ""}: readonly ${nestedName}[];`
      : `  readonly ${propName}${isOptional ? "?" : ""}: ${nestedName};`;
  });

  return {
    code: configInterfaceTemplate(name, [...attrLines, ...blockLines]),
    props: [...attrProps, ...blockProps],
  };
};

const generateConfigWithNestedTypes = (
  name: string,
  block: SchemaBlock,
  baseType?: string,
): ConfigWithNestedResult => {
  const attrEntries = Object.entries(block.attributes ?? {});
  const blockEntries = Object.entries(block.block_types ?? {});

  const attrProps: PropMapping[] = attrEntries.map(([attrName]) => ({
    tfName: toTfName(attrName),
    tsName: toCamelCase(attrName),
  }));
  const attrLines = attrEntries.map(([attrName, attr]) => {
    const tsType = parseSchemaType(attr.type);
    const optional = attr.optional === true || attr.computed === true;
    const propName = toCamelCase(attrName);
    return `  readonly ${propName}${optional ? "?" : ""}: ${tsType};`;
  });

  // Collect getters for computed attributes (excluding reserved names)
  const getters: readonly AttributeGetter[] = attrEntries
    .filter(
      ([attrName, attr]) => attr.computed === true && !RESERVED_NAMES.has(toCamelCase(attrName)),
    )
    .map(([attrName]) => ({ tfName: toTfName(attrName), tsName: toCamelCase(attrName) }));

  const blockProps: PropMapping[] = blockEntries.map(([blockName]) => ({
    tfName: toTfName(blockName),
    tsName: toCamelCase(blockName),
  }));
  const blockLines = blockEntries.map(([blockName, blockType]) => {
    const nestedName = `${name}${toPascalCase(blockName)}`;
    const propName = toCamelCase(blockName);
    const isList = blockType.nesting_mode === "list" || blockType.nesting_mode === "set";
    const isOptional = blockType.min_items === undefined || blockType.min_items === 0;
    return isList
      ? `  readonly ${propName}${isOptional ? "?" : ""}: readonly ${nestedName}[];`
      : `  readonly ${propName}${isOptional ? "?" : ""}: ${nestedName};`;
  });

  const nestedTypes = blockEntries.flatMap(([blockName, blockType]) => {
    const nestedName = `${name}${toPascalCase(blockName)}`;
    return generateConfigWithNestedTypes(nestedName, blockType.block).types;
  });

  return {
    types: [...nestedTypes, configInterfaceTemplate(name, [...attrLines, ...blockLines], baseType)],
    props: [...attrProps, ...blockProps],
    getters,
  };
};

const toPascalCase = (s: string): string => {
  return s
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
};

const toCamelCase = (s: string): string => {
  const pascal = toPascalCase(s);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};

const toTfName = (s: string): string => {
  return s.replace(/-/g, "_");
};

const resourceNameToClassName = (name: string): string => {
  // google_storage_bucket -> GoogleStorageBucket
  return toPascalCase(name);
};
