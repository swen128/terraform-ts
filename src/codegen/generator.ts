import type {
  ProviderSchema,
  SchemaBlock,
  AttributeSchema,
  BlockTypeSchema,
  SchemaType,
} from "./schema.js";

export type GeneratedFiles = ReadonlyMap<string, string>;

// --- Naming utilities ---

const snakeToCamelCase = (str: string): string =>
  str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

const snakeToPascalCase = (str: string): string => {
  const camel = snakeToCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
};

const snakeToKebabCase = (str: string): string => str.replace(/_/g, "-");

const stripProviderPrefix = (name: string, providerName: string): string => {
  const prefix = `${providerName}_`;
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
};

// --- Type mapping ---

const mapSchemaTypeToTsConfig = (type: SchemaType): string => {
  if (typeof type === "string") {
    switch (type) {
      case "string":
        return "TfString";
      case "number":
        return "TfNumber";
      case "bool":
        return "TfBoolean";
      case "dynamic":
        return "unknown";
    }
  }
  if (Array.isArray(type)) {
    const [container, inner] = type;
    switch (container) {
      case "list":
        if (inner === "string") return "TfStringList";
        if (inner === "number") return "TfNumberList";
        return `readonly ${mapSchemaTypeToTsConfig(inner)}[]`;
      case "set":
        if (inner === "string") return "TfStringList";
        if (inner === "number") return "TfNumberList";
        return `readonly ${mapSchemaTypeToTsConfig(inner)}[]`;
      case "map":
        if (inner === "string") return "TfStringMap";
        return `Readonly<Record<string, ${mapSchemaTypeToTsConfig(inner)}>>`;
      case "object":
        return "unknown";
      case "tuple":
        return "unknown";
    }
  }
  return "unknown";
};

// --- Code generation helpers ---

type TypeNameRegistry = {
  usedNames: Set<string>;
  blockTypeNames: Map<string, string>; // baseName -> actualName
};

const createTypeNameRegistry = (): TypeNameRegistry => ({
  usedNames: new Set(),
  blockTypeNames: new Map(),
});

const registerTypeName = (registry: TypeNameRegistry, name: string): string => {
  let finalName = name;
  while (registry.usedNames.has(finalName)) {
    finalName = `${finalName}A`;
  }
  registry.usedNames.add(finalName);
  return finalName;
};

const registerBlockTypeName = (registry: TypeNameRegistry, baseName: string): string => {
  const actualName = registerTypeName(registry, baseName);
  registry.blockTypeNames.set(baseName, actualName);
  return actualName;
};

const getBlockTypeName = (registry: TypeNameRegistry, baseName: string): string =>
  registry.blockTypeNames.get(baseName) ?? baseName;

const isPropertyOptional = (attr: AttributeSchema): boolean =>
  attr.required !== true || attr.optional === true || attr.computed === true;

const isInputAttribute = (attr: AttributeSchema): boolean =>
  attr.required === true || attr.optional === true;

const isBlockOptional = (block: BlockTypeSchema): boolean =>
  block.min_items === undefined || block.min_items === 0;

const getBlockPropertyType = (block: BlockTypeSchema, typeName: string): string => {
  if (block.nesting_mode === "single") {
    return typeName;
  }
  if ((block.nesting_mode === "list" || block.nesting_mode === "set") && block.max_items === 1) {
    return `${typeName} | readonly ${typeName}[]`;
  }
  return `readonly ${typeName}[]`;
};

const getBlockConstructorValue = (
  block: BlockTypeSchema,
  tfName: string,
  tsName: string,
): string => {
  if ((block.nesting_mode === "list" || block.nesting_mode === "set") && block.max_items === 1) {
    return `${tfName}: config.${tsName} !== undefined ? (Array.isArray(config.${tsName}) ? config.${tsName} : [config.${tsName}]) : undefined,`;
  }
  return `${tfName}: config.${tsName},`;
};

// Reserved property names that should not have getters generated
const RESERVED_NAMES = new Set([
  "node",
  "provider",
  "dependsOn",
  "count",
  "forEach",
  "lifecycle",
  "fqn",
  "terraformResourceType",
  "terraformGeneratorMetadata",
  "connection",
  "provisioners",
]);

type BlockTypeInfo = {
  readonly typeName: string;
  readonly code: string;
};

const generateBlockTypes = (
  block: SchemaBlock,
  className: string,
  registry: TypeNameRegistry,
): readonly BlockTypeInfo[] => {
  const result: BlockTypeInfo[] = [];

  if (!block.block_types) {
    return result;
  }

  for (const [name, blockType] of Object.entries(block.block_types)) {
    const baseName = `${className}${snakeToPascalCase(name)}`;
    const blockTypeName = registerBlockTypeName(registry, baseName);

    // Recursively generate nested block types
    const nestedTypes = generateBlockTypes(blockType.block, blockTypeName, registry);
    result.push(...nestedTypes);

    // Generate the block type itself
    const properties: string[] = [];

    if (blockType.block.attributes) {
      for (const [attrName, attr] of Object.entries(blockType.block.attributes)) {
        const tsName = snakeToCamelCase(attrName);
        const tsType = mapSchemaTypeToTsConfig(attr.type);
        const optional = isPropertyOptional(attr) ? "?" : "";
        properties.push(`  readonly ${tsName}${optional}: ${tsType};`);
      }
    }

    if (blockType.block.block_types) {
      for (const [nestedName, nestedBlock] of Object.entries(blockType.block.block_types)) {
        const tsName = snakeToCamelCase(nestedName);
        const nestedTypeName = `${blockTypeName}${snakeToPascalCase(nestedName)}`;
        const propType = getBlockPropertyType(nestedBlock, nestedTypeName);
        const optional = isBlockOptional(nestedBlock) ? "?" : "";
        properties.push(`  readonly ${tsName}${optional}: ${propType};`);
      }
    }

    const code = `export type ${blockTypeName} = {
${properties.join("\n")}
};`;
    result.push({ typeName: blockTypeName, code });
  }

  return result;
};

const generateImports = (
  baseClass: string,
  baseConfig: string,
  block: SchemaBlock,
  includeProvider = false,
): string => {
  const types = new Set<string>(["Construct", "TokenValue", baseConfig]);
  if (includeProvider) {
    types.add("TerraformProvider");
  }

  if (block.attributes) {
    for (const attr of Object.values(block.attributes)) {
      const tsType = mapSchemaTypeToTsConfig(attr.type);
      if (
        tsType.startsWith("Tf") ||
        tsType === "TfString" ||
        tsType === "TfNumber" ||
        tsType === "TfBoolean" ||
        tsType === "TfStringList" ||
        tsType === "TfNumberList" ||
        tsType === "TfStringMap"
      ) {
        types.add(tsType);
      }
    }
  }

  const collectBlockTypes = (b: SchemaBlock): void => {
    if (b.block_types) {
      for (const blockType of Object.values(b.block_types)) {
        if (blockType.block.attributes) {
          for (const attr of Object.values(blockType.block.attributes)) {
            const tsType = mapSchemaTypeToTsConfig(attr.type);
            if (tsType.startsWith("Tf")) {
              types.add(tsType);
            }
          }
        }
        collectBlockTypes(blockType.block);
      }
    }
  };
  collectBlockTypes(block);

  const sortedTypes = Array.from(types).sort();
  return `import type { ${sortedTypes.join(", ")} } from "tfts";
import { ${baseClass} } from "tfts";`;
};

const generateConfigTypeWithName = (
  configTypeName: string,
  className: string,
  block: SchemaBlock,
  baseConfig: string,
  registry: TypeNameRegistry,
): string => {
  const properties: string[] = [];

  if (block.attributes) {
    for (const [name, attr] of Object.entries(block.attributes)) {
      const tsName = snakeToCamelCase(name);
      const tsType = mapSchemaTypeToTsConfig(attr.type);
      const optional = isPropertyOptional(attr) ? "?" : "";
      properties.push(`  readonly ${tsName}${optional}: ${tsType};`);
    }
  }

  if (block.block_types) {
    for (const [name, blockType] of Object.entries(block.block_types)) {
      const tsName = snakeToCamelCase(name);
      const baseName = `${className}${snakeToPascalCase(name)}`;
      const actualBlockTypeName = getBlockTypeName(registry, baseName);
      const propType = getBlockPropertyType(blockType, actualBlockTypeName);
      const optional = isBlockOptional(blockType) ? "?" : "";
      properties.push(`  readonly ${tsName}${optional}: ${propType};`);
    }
  }

  return `export type ${configTypeName} = {
${properties.join("\n")}
} & ${baseConfig};`;
};

const generateConfigType = (
  className: string,
  block: SchemaBlock,
  baseConfig: string,
  registry: TypeNameRegistry,
): string => {
  const configTypeName = registerTypeName(registry, `${className}Config`);
  return generateConfigTypeWithName(configTypeName, className, block, baseConfig, registry);
};

const generateConstructorBody = (block: SchemaBlock): string => {
  const lines: string[] = [];

  if (block.attributes) {
    for (const name of Object.keys(block.attributes)) {
      const tsName = snakeToCamelCase(name);
      lines.push(`      ${name}: config.${tsName},`);
    }
  }

  if (block.block_types) {
    for (const [name, blockType] of Object.entries(block.block_types)) {
      const tsName = snakeToCamelCase(name);
      lines.push(`      ${getBlockConstructorValue(blockType, name, tsName)}`);
    }
  }

  return lines.join("\n");
};

const generateGetters = (block: SchemaBlock): string =>
  Object.keys(block.attributes ?? {})
    .filter((name) => !RESERVED_NAMES.has(snakeToCamelCase(name)))
    .map((name) => {
      const tsName = snakeToCamelCase(name);
      return `  get ${tsName}(): TokenValue<string> {
    return this.getStringAttribute("${name}");
  }`;
    })
    .join("\n\n");

const generateInputGetters = (block: SchemaBlock): string =>
  Object.entries(block.attributes ?? {})
    .filter(([, attr]) => isInputAttribute(attr))
    .map(([name, attr]) => {
      const tsName = snakeToCamelCase(name);
      const tsType = mapSchemaTypeToTsConfig(attr.type);
      return `  get ${tsName}Input(): ${tsType} | undefined {
    return this._config.${tsName};
  }`;
    })
    .join("\n\n");

// --- Provider generation ---

const generateProviderClass = (
  providerName: string,
  source: string,
  block: SchemaBlock,
): string => {
  const className = `${snakeToPascalCase(providerName)}Provider`;
  const registry = createTypeNameRegistry();
  registry.usedNames.add(className);

  const blockTypes = generateBlockTypes(block, className, registry);
  const imports = generateImports("TerraformProvider", "TerraformProviderConfig", block);
  const configType = generateConfigType(className, block, "TerraformProviderConfig", registry);
  const constructorBody = generateConstructorBody(block);
  const getters = generateGetters(block);

  const blockTypeCode =
    blockTypes.length > 0 ? blockTypes.map((bt) => bt.code).join("\n\n") + "\n\n" : "";

  const getterSection = getters ? `\n\n${getters}` : "";

  return `${imports}

${blockTypeCode}${configType}

export class ${className} extends TerraformProvider {
  constructor(scope: Construct, id: string, config: ${className}Config = {}) {
    super(scope, id, "${source}", {
${constructorBody}
    }, config);
  }${getterSection}
}
`;
};

// --- Resource generation ---

const generateResourceClass = (
  resourceName: string,
  providerName: string,
  block: SchemaBlock,
): string => {
  const strippedName = stripProviderPrefix(resourceName, providerName);
  const className = snakeToPascalCase(strippedName);
  const registry = createTypeNameRegistry();
  registry.usedNames.add(className);
  // Reserve the config type name first so nested blocks get the A suffix if collision
  registry.usedNames.add(`${className}Config`);

  const blockTypes = generateBlockTypes(block, className, registry);
  const imports = generateImports("TerraformResource", "TerraformResourceConfig", block, true);
  const configType = generateConfigTypeWithName(
    `${className}Config`,
    className,
    block,
    "TerraformResourceConfig",
    registry,
  );
  const constructorBody = generateConstructorBody(block);
  const getters = generateGetters(block);
  const inputGetters = generateInputGetters(block);

  const blockTypeCode =
    blockTypes.length > 0 ? blockTypes.map((bt) => bt.code).join("\n\n") + "\n\n" : "";

  const allGetters = [getters, inputGetters].filter(Boolean).join("\n\n");
  const getterSection = allGetters ? `\n\n${allGetters}` : "";

  return `${imports}

${blockTypeCode}${configType}

export class ${className} extends TerraformResource {
  private readonly _config: ${className}Config;

  constructor(scope: Construct, id: string, config: ${className}Config) {
    super(scope, id, "${resourceName}", {
${constructorBody}
    }, config);
    this._config = config;
  }

  static importFrom(scope: Construct, id: string, resourceId: TfString, provider?: TerraformProvider): ${className} {
    return new ${className}(scope, id, { lifecycle: { importId: resourceId }, provider } as ${className}Config);
  }${getterSection}
}
`;
};

// --- Data source generation ---

const generateDataSourceClass = (
  dataSourceName: string,
  providerName: string,
  block: SchemaBlock,
): string => {
  const strippedName = stripProviderPrefix(dataSourceName, providerName);
  const className = `Data${snakeToPascalCase(strippedName)}`;
  const registry = createTypeNameRegistry();
  registry.usedNames.add(className);

  const blockTypes = generateBlockTypes(block, className, registry);
  const imports = generateImports("TerraformDataSource", "TerraformDataSourceConfig", block);
  const configType = generateConfigType(className, block, "TerraformDataSourceConfig", registry);
  const constructorBody = generateConstructorBody(block);
  const getters = generateGetters(block);
  const inputGetters = generateInputGetters(block);

  const blockTypeCode =
    blockTypes.length > 0 ? blockTypes.map((bt) => bt.code).join("\n\n") + "\n\n" : "";

  const allGetters = [getters, inputGetters].filter(Boolean).join("\n\n");
  const getterSection = allGetters ? `\n\n${allGetters}` : "";

  return `${imports}

${blockTypeCode}${configType}

export class ${className} extends TerraformDataSource {
  private readonly _config: ${className}Config;

  constructor(scope: Construct, id: string, config: ${className}Config) {
    super(scope, id, "${dataSourceName}", {
${constructorBody}
    }, config);
    this._config = config;
  }${getterSection}
}
`;
};

// --- Index file generation ---

type NamespaceExport = {
  readonly namespace: string;
  readonly path: string;
};

const generateIndexFile = (exports: readonly NamespaceExport[]): string => {
  const lines = exports
    .slice()
    .sort((a, b) => a.namespace.localeCompare(b.namespace))
    .map((e) => `export * as ${e.namespace} from "./${e.path}";`);
  return lines.join("\n") + "\n";
};

// --- Main generator ---

export const generateProviderFiles = (name: string, schema: ProviderSchema): GeneratedFiles => {
  const files = new Map<string, string>();
  const namespaceExports: NamespaceExport[] = [];

  // Find the provider schema entry
  const providerEntry = Object.entries(schema.provider_schemas).find(
    ([source]) => source.includes(`/${name}`) || source.endsWith(`/${name}`),
  );

  if (!providerEntry) {
    return files;
  }

  const [source, schemaEntry] = providerEntry;

  // Generate provider
  files.set("provider/index.ts", generateProviderClass(name, source, schemaEntry.provider.block));
  namespaceExports.push({ namespace: "provider", path: "provider/index.js" });

  // Generate resources
  if (schemaEntry.resource_schemas) {
    for (const [resourceName, resourceSchema] of Object.entries(schemaEntry.resource_schemas)) {
      const strippedName = stripProviderPrefix(resourceName, name);
      const kebabName = snakeToKebabCase(strippedName);
      const path = `lib/${kebabName}/index.ts`;
      files.set(path, generateResourceClass(resourceName, name, resourceSchema.block));
      namespaceExports.push({
        namespace: snakeToCamelCase(strippedName),
        path: `lib/${kebabName}/index.js`,
      });
    }
  }

  // Generate data sources
  if (schemaEntry.data_source_schemas) {
    for (const [dataSourceName, dataSourceSchema] of Object.entries(
      schemaEntry.data_source_schemas,
    )) {
      const strippedName = stripProviderPrefix(dataSourceName, name);
      const kebabName = snakeToKebabCase(strippedName);
      const path = `lib/data-${kebabName}/index.ts`;
      files.set(path, generateDataSourceClass(dataSourceName, name, dataSourceSchema.block));
      namespaceExports.push({
        namespace: `data${snakeToPascalCase(strippedName)}`,
        path: `lib/data-${kebabName}/index.js`,
      });
    }
  }

  // Generate index file
  files.set("index.ts", generateIndexFile(namespaceExports));

  return files;
};
