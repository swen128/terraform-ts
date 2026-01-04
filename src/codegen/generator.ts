import type { ProviderSchema, ResourceSchema, SchemaBlock } from "./schema.js";
import { parseSchemaType } from "./schema.js";
import {
  resourceTemplate,
  providerTemplate,
  dataSourceTemplate,
  configInterfaceTemplate,
  type AttributeGetter,
  type PropMapping,
} from "./templates.js";

const RESOURCE_IMPORTS = `import type { Construct, TokenString, TerraformResourceConfig, TfString, TfNumber, TfBoolean, TfStringList, TfNumberList, TfStringMap } from "tfts";
import { TerraformResource } from "tfts";`;

const DATASOURCE_IMPORTS = `import type { Construct, TokenString, TerraformDataSourceConfig, TfString, TfNumber, TfBoolean, TfStringList, TfNumberList, TfStringMap } from "tfts";
import { TerraformDataSource } from "tfts";`;

const PROVIDER_IMPORTS = `import type { Construct, TerraformProviderConfig, TfString, TfNumber, TfBoolean, TfStringList, TfNumberList, TfStringMap } from "tfts";
import { TerraformProvider } from "tfts";`;

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

export type GeneratedFiles = ReadonlyMap<string, string>;

export const generateProviderFiles = (name: string, schema: ProviderSchema): GeneratedFiles => {
  const entries = Object.entries(schema.provider_schemas);
  if (entries.length === 0) {
    return new Map([["index.ts", `// No schema available for provider ${name}\nexport {};\n`]]);
  }

  const firstEntry = entries[0];
  if (firstEntry === undefined) {
    return new Map([["index.ts", `// No schema available for provider ${name}\nexport {};\n`]]);
  }

  const [source, entry] = firstEntry;
  const providerName = snakeToPascalCase(name);
  const files = new Map<string, string>();
  const namespaceExports: string[] = [];

  // Provider file (in provider/ subdirectory)
  const providerConfig = generateConfigWithNestedTypes(
    `${providerName}ProviderConfig`,
    entry.provider,
    "TerraformProviderConfig",
  );
  const providerClass = providerTemplate(providerName, source, providerConfig.props);
  const providerContent = [PROVIDER_IMPORTS, ...providerConfig.types, providerClass].join("\n\n");
  files.set("provider/index.ts", providerContent);
  namespaceExports.push(`export * as provider from "./provider/index.js";`);

  // Resource files (each in lib/ subdirectory for CDKTF compatibility)
  for (const [resourceName, resourceSchema] of Object.entries(entry.resource_schemas ?? {})) {
    const className = terraformNameToClassName(resourceName);
    const dirName = terraformNameToFileName(resourceName);
    const namespaceName = pascalToCamelCase(className);
    const config = generateConfigWithNestedTypes(
      `${className}Config`,
      resourceSchema.block,
      "TerraformResourceConfig",
    );
    const resourceClass = resourceTemplate(className, resourceName, config.props, config.getters);
    const content = [RESOURCE_IMPORTS, ...config.types, resourceClass].join("\n\n");
    files.set(`lib/${dirName}/index.ts`, content);
    namespaceExports.push(`export * as ${namespaceName} from "./lib/${dirName}/index.js";`);
  }

  // Data source files (each in lib/ subdirectory for CDKTF compatibility)
  for (const [dataSourceName, dataSourceSchema] of Object.entries(
    entry.data_source_schemas ?? {},
  )) {
    const baseClassName = terraformNameToClassName(dataSourceName);
    const className = `Data${baseClassName}`;
    const dirName = `data-${terraformNameToFileName(dataSourceName)}`;
    const namespaceName = `data${baseClassName}`;
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
    const content = [DATASOURCE_IMPORTS, ...config.types, dataSourceClass].join("\n\n");
    files.set(`lib/${dirName}/index.ts`, content);
    namespaceExports.push(`export * as ${namespaceName} from "./lib/${dirName}/index.js";`);
  }

  // Index file with namespace exports
  files.set("index.ts", namespaceExports.join("\n") + "\n");

  return files;
};

// Legacy single-file generator (kept for backward compatibility)
export const generateProvider = (name: string, schema: ProviderSchema): string => {
  const files = generateProviderFiles(name, schema);
  // Combine all files except index.ts into one
  const parts: string[] = [];
  for (const [fileName, content] of files) {
    if (fileName !== "index.ts") {
      // Strip imports from non-first files to avoid duplicates
      if (parts.length === 0) {
        parts.push(content);
      } else {
        const lines = content.split("\n");
        const nonImportLines = lines.filter(
          (line) => !line.startsWith("import ") && line.trim() !== "",
        );
        parts.push(nonImportLines.join("\n"));
      }
    }
  }
  return parts.join("\n\n");
};

export const generateResource = (name: string, schema: ResourceSchema): string => {
  const className = terraformNameToClassName(name);
  const config = generateConfigInterface(`${className}Config`, schema.block);
  return `${config.code}\n\n${resourceTemplate(className, name, config.props)}`;
};

export const generateDataSource = (name: string, schema: ResourceSchema): string => {
  const className = `Data${terraformNameToClassName(name)}`;
  const config = generateConfigInterface(`${className}Config`, schema.block);
  return `${config.code}\n\n${dataSourceTemplate(className, name, config.props)}`;
};

export const generateConfig = (name: string, schema: SchemaBlock): string => {
  return generateConfigInterface(name, schema).code;
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
    tsName: snakeToCamelCase(attrName),
  }));
  const attrLines = attrEntries.map(([attrName, attr]) => {
    const tsType = parseSchemaType(attr.type);
    const optional = attr.optional === true || attr.computed === true;
    const propName = snakeToCamelCase(attrName);
    return `  readonly ${propName}${optional ? "?" : ""}: ${tsType};`;
  });

  const blockProps: PropMapping[] = blockEntries.map(([blockName, blockType]) => {
    const isList = blockType.nesting_mode === "list" || blockType.nesting_mode === "set";
    const isSingleItem = isList && blockType.max_items === 1;
    return {
      tfName: toTfName(blockName),
      tsName: snakeToCamelCase(blockName),
      isListBlock: isSingleItem,
    };
  });
  const blockLines = blockEntries.map(([blockName, blockType]) => {
    const nestedName = `${name}${snakeToPascalCase(blockName)}`;
    const propName = snakeToCamelCase(blockName);
    const isList = blockType.nesting_mode === "list" || blockType.nesting_mode === "set";
    const isSingleItem = isList && blockType.max_items === 1;
    const isOptional = blockType.min_items === undefined || blockType.min_items === 0;
    if (isSingleItem) {
      // max_items=1: accept single object or array
      return `  readonly ${propName}${isOptional ? "?" : ""}: ${nestedName} | readonly ${nestedName}[];`;
    }
    if (isList) {
      return `  readonly ${propName}${isOptional ? "?" : ""}: readonly ${nestedName}[];`;
    }
    return `  readonly ${propName}${isOptional ? "?" : ""}: ${nestedName};`;
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
    tsName: snakeToCamelCase(attrName),
  }));
  const attrLines = attrEntries.map(([attrName, attr]) => {
    const tsType = parseSchemaType(attr.type);
    const optional = attr.optional === true || attr.computed === true;
    const propName = snakeToCamelCase(attrName);
    return `  readonly ${propName}${optional ? "?" : ""}: ${tsType};`;
  });

  // Collect getters for all attributes (excluding reserved names)
  const getters: readonly AttributeGetter[] = attrEntries
    .filter(([attrName]) => !RESERVED_NAMES.has(snakeToCamelCase(attrName)))
    .map(([attrName]) => ({ tfName: toTfName(attrName), tsName: snakeToCamelCase(attrName) }));

  const blockProps: PropMapping[] = blockEntries.map(([blockName, blockType]) => {
    const isList = blockType.nesting_mode === "list" || blockType.nesting_mode === "set";
    const isSingleItem = isList && blockType.max_items === 1;
    return {
      tfName: toTfName(blockName),
      tsName: snakeToCamelCase(blockName),
      isListBlock: isSingleItem,
    };
  });
  const blockLines = blockEntries.map(([blockName, blockType]) => {
    const nestedName = `${name}${snakeToPascalCase(blockName)}`;
    const propName = snakeToCamelCase(blockName);
    const isList = blockType.nesting_mode === "list" || blockType.nesting_mode === "set";
    const isSingleItem = isList && blockType.max_items === 1;
    const isOptional = blockType.min_items === undefined || blockType.min_items === 0;
    if (isSingleItem) {
      // max_items=1: accept single object or array
      return `  readonly ${propName}${isOptional ? "?" : ""}: ${nestedName} | readonly ${nestedName}[];`;
    }
    if (isList) {
      return `  readonly ${propName}${isOptional ? "?" : ""}: readonly ${nestedName}[];`;
    }
    return `  readonly ${propName}${isOptional ? "?" : ""}: ${nestedName};`;
  });

  const nestedTypes = blockEntries.flatMap(([blockName, blockType]) => {
    const nestedName = `${name}${snakeToPascalCase(blockName)}`;
    return generateConfigWithNestedTypes(nestedName, blockType.block).types;
  });

  return {
    types: [...nestedTypes, configInterfaceTemplate(name, [...attrLines, ...blockLines], baseType)],
    props: [...attrProps, ...blockProps],
    getters,
  };
};

const snakeToPascalCase = (s: string): string => {
  return s
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
};

const snakeToCamelCase = (s: string): string => {
  const pascal = snakeToPascalCase(s);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};

const pascalToCamelCase = (s: string): string => {
  return s.charAt(0).toLowerCase() + s.slice(1);
};

const toTfName = (s: string): string => {
  return s.replace(/-/g, "_");
};

const terraformNameToClassName = (name: string): string => {
  // google_storage_bucket -> StorageBucket (strip provider prefix)
  // random_password -> Password
  const parts = name.split("_");
  // Remove first part (provider name)
  const withoutProvider = parts.slice(1).join("_");
  return snakeToPascalCase(withoutProvider || name);
};

const terraformNameToFileName = (name: string): string => {
  // google_storage_bucket -> storage-bucket
  const parts = name.split("_");
  const withoutProvider = parts.slice(1).join("-");
  return withoutProvider || name.replace(/_/g, "-");
};
