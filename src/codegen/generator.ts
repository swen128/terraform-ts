import type { ProviderSchema, ResourceSchema, SchemaBlock } from "./schema.js";
import { parseSchemaType } from "./schema.js";
import {
  resourceTemplate,
  providerTemplate,
  dataSourceTemplate,
  configInterfaceTemplate,
  indexTemplate,
} from "./templates.js";

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

  const parts: string[] = [];

  // Provider class
  const providerConfig = generateConfigInterface(`${providerName}Config`, entry.provider);
  const providerClass = providerTemplate(providerName, source, providerConfig.props);
  parts.push(providerConfig.code);
  parts.push(providerClass);

  // Resources
  for (const [resourceName, resourceSchema] of Object.entries(entry.resource_schemas)) {
    const className = resourceNameToClassName(resourceName);
    const config = generateConfigInterface(`${className}Config`, resourceSchema.block);
    const resourceClass = resourceTemplate(className, resourceName, config.props);
    parts.push(config.code);
    parts.push(resourceClass);
  }

  // Data sources
  for (const [dataSourceName, dataSourceSchema] of Object.entries(entry.data_source_schemas)) {
    const className = `Data${resourceNameToClassName(dataSourceName)}`;
    const config = generateConfigInterface(`${className}Config`, dataSourceSchema.block);
    const dataSourceClass = dataSourceTemplate(className, dataSourceName, config.props);
    parts.push(config.code);
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
  readonly props: readonly string[];
};

const generateConfigInterface = (name: string, block: SchemaBlock): ConfigResult => {
  const props: string[] = [];
  const lines: string[] = [];

  if (block.attributes !== undefined) {
    for (const [attrName, attr] of Object.entries(block.attributes)) {
      const tsType = parseSchemaType(attr.type);
      const optional = attr.optional === true || attr.computed === true;
      const propName = toSnakeCase(attrName);
      props.push(propName);
      lines.push(`  readonly ${propName}${optional ? "?" : ""}: ${tsType};`);
    }
  }

  if (block.block_types !== undefined) {
    for (const [blockName, blockType] of Object.entries(block.block_types)) {
      const nestedName = `${name}${toPascalCase(blockName)}`;
      const propName = toSnakeCase(blockName);
      props.push(propName);

      const isList = blockType.nesting_mode === "list" || blockType.nesting_mode === "set";
      const isOptional = blockType.min_items === undefined || blockType.min_items === 0;

      if (isList) {
        lines.push(`  readonly ${propName}${isOptional ? "?" : ""}: readonly ${nestedName}[];`);
      } else {
        lines.push(`  readonly ${propName}${isOptional ? "?" : ""}: ${nestedName};`);
      }
    }
  }

  const code = configInterfaceTemplate(name, lines);
  return { code, props };
};

const toPascalCase = (s: string): string => {
  return s
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
};

const toSnakeCase = (s: string): string => {
  return s.replace(/-/g, "_");
};

const resourceNameToClassName = (name: string): string => {
  // google_storage_bucket -> GoogleStorageBucket
  return toPascalCase(name);
};
