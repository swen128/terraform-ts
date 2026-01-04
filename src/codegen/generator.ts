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
  switch (type.kind) {
    case "string":
      return "TfString";
    case "number":
      return "TfNumber";
    case "bool":
      return "TfBoolean";
    case "dynamic":
      return "unknown";
    case "list":
      if (type.inner.kind === "string") return "TfStringList";
      if (type.inner.kind === "number") return "TfNumberList";
      return `readonly ${mapSchemaTypeToTsConfig(type.inner)}[]`;
    case "set":
      if (type.inner.kind === "string") return "TfStringList";
      if (type.inner.kind === "number") return "TfNumberList";
      return `readonly ${mapSchemaTypeToTsConfig(type.inner)}[]`;
    case "map":
      if (type.inner.kind === "string") return "TfStringMap";
      return `Readonly<Record<string, ${mapSchemaTypeToTsConfig(type.inner)}>>`;
    case "object":
      return "unknown";
    case "tuple":
      return "unknown";
  }
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
  if (block.max_items === 1) {
    return typeName;
  }
  return `readonly ${typeName}[]`;
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

type ComputedObjectSchema = Readonly<Record<string, SchemaType>>;

const getComputedListObjectSchema = (attr: AttributeSchema): ComputedObjectSchema | undefined => {
  if (attr.computed !== true) return undefined;
  const { type } = attr;
  if (type.kind !== "list" && type.kind !== "set") return undefined;
  if (type.inner.kind !== "object") return undefined;
  return type.inner.fields;
};

const hasComputedAttributes = (block: SchemaBlock): boolean =>
  Object.values(block.attributes ?? {}).some((attr) => attr.computed === true);

type OutputClassInfo = {
  readonly className: string;
  readonly code: string;
};

const makeOutputClass = (className: string, getters: readonly string[]): string =>
  `class ${className} extends ComputedObject {\n${getters.join("\n\n")}\n}`;

const makeGetter = (attrName: string): string => {
  const tsName = snakeToCamelCase(attrName);
  return `  get ${tsName}(): TokenValue<string> {\n    return this._getStringAttribute("${attrName}");\n  }`;
};

// Generate output classes for computed block types and computed list/object attributes
const generateOutputClasses = (
  block: SchemaBlock,
  baseClassName: string,
  registry: TypeNameRegistry,
): readonly OutputClassInfo[] => {
  const fromAttrs = Object.entries(block.attributes ?? {})
    .flatMap(([name, attr]) => {
      const schema = getComputedListObjectSchema(attr);
      if (schema === undefined) return [];
      return [{ name, schema }];
    })
    .map(({ name, schema }) => {
      const className = registerTypeName(
        registry,
        `${baseClassName}${snakeToPascalCase(name)}Output`,
      );
      const getters = Object.keys(schema).map(makeGetter);
      return { className, code: makeOutputClass(className, getters) };
    });

  const fromBlocks = Object.entries(block.block_types ?? {})
    .filter(([, bt]) => hasComputedAttributes(bt.block))
    .map(([name, blockType]) => {
      const className = registerTypeName(
        registry,
        `${baseClassName}${snakeToPascalCase(name)}Output`,
      );
      const getters = Object.entries(blockType.block.attributes ?? {})
        .filter(([, attr]) => attr.computed === true)
        .map(([attrName]) => makeGetter(attrName));
      return { className, code: makeOutputClass(className, getters) };
    });

  return [...fromAttrs, ...fromBlocks];
};

// Generate getters for computed block types and computed list/object attributes
const generateBlockGetters = (block: SchemaBlock, baseClassName: string): string => {
  const fromAttrs = Object.entries(block.attributes ?? {})
    .filter(
      ([name, attr]) =>
        getComputedListObjectSchema(attr) !== undefined &&
        !RESERVED_NAMES.has(snakeToCamelCase(name)),
    )
    .map(([name]) => {
      const tsName = snakeToCamelCase(name);
      const outputClassName = `${baseClassName}${snakeToPascalCase(name)}Output`;
      return `  get ${tsName}(): ComputedList<${outputClassName}> {\n    return new ComputedList(this.fqn, "${name}", (fqn, path) => new ${outputClassName}(fqn, path));\n  }`;
    });

  const fromBlocks = Object.entries(block.block_types ?? {})
    .filter(
      ([name, bt]) =>
        hasComputedAttributes(bt.block) && !RESERVED_NAMES.has(snakeToCamelCase(name)),
    )
    .map(([name, blockType]) => {
      const tsName = snakeToCamelCase(name);
      const outputClassName = `${baseClassName}${snakeToPascalCase(name)}Output`;
      return blockType.nesting_mode === "single"
        ? `  get ${tsName}(): ${outputClassName} {\n    return new ${outputClassName}(this.fqn, "${name}");\n  }`
        : `  get ${tsName}(): ComputedList<${outputClassName}> {\n    return new ComputedList(this.fqn, "${name}", (fqn, path) => new ${outputClassName}(fqn, path));\n  }`;
    });

  return [...fromAttrs, ...fromBlocks].join("\n\n");
};

type BlockTypeInfo = {
  readonly typeName: string;
  readonly code: string;
};

const generateBlockTypes = (
  block: SchemaBlock,
  className: string,
  registry: TypeNameRegistry,
): readonly BlockTypeInfo[] =>
  Object.entries(block.block_types ?? {}).flatMap(([name, blockType]) => {
    const baseName = `${className}${snakeToPascalCase(name)}`;
    const blockTypeName = registerBlockTypeName(registry, baseName);

    // Recursively generate nested block types
    const nestedTypes = generateBlockTypes(blockType.block, blockTypeName, registry);

    // Generate the block type itself
    const attrProperties = Object.entries(blockType.block.attributes ?? {}).map(
      ([attrName, attr]) => {
        const tsName = snakeToCamelCase(attrName);
        const tsType = mapSchemaTypeToTsConfig(attr.type);
        const optional = isPropertyOptional(attr) ? "?" : "";
        return `  readonly ${tsName}${optional}: ${tsType};`;
      },
    );

    const blockProperties = Object.entries(blockType.block.block_types ?? {}).map(
      ([nestedName, nestedBlock]) => {
        const tsName = snakeToCamelCase(nestedName);
        const nestedTypeName = `${blockTypeName}${snakeToPascalCase(nestedName)}`;
        const propType = getBlockPropertyType(nestedBlock, nestedTypeName);
        const optional = isBlockOptional(nestedBlock) ? "?" : "";
        return `  readonly ${tsName}${optional}: ${propType};`;
      },
    );

    const properties = [...attrProperties, ...blockProperties];
    const code = `export type ${blockTypeName} = {
${properties.join("\n")}
};`;

    return [...nestedTypes, { typeName: blockTypeName, code }];
  });

const hasComputedListObjectAttrs = (block: SchemaBlock): boolean =>
  Object.values(block.attributes ?? {}).some(
    (attr) => getComputedListObjectSchema(attr) !== undefined,
  );

const hasComputedBlockTypes = (block: SchemaBlock): boolean => {
  const checkBlock = (b: SchemaBlock): boolean =>
    Object.values(b.block_types ?? {}).some(
      (bt) => hasComputedAttributes(bt.block) || checkBlock(bt.block),
    );
  return checkBlock(block);
};

const collectTfTypes = (block: SchemaBlock): readonly string[] => {
  const fromAttrs = Object.values(block.attributes ?? {}).map((attr) =>
    mapSchemaTypeToTsConfig(attr.type),
  );
  const fromBlocks = Object.values(block.block_types ?? {}).flatMap((bt) =>
    collectTfTypes(bt.block),
  );
  return [...fromAttrs, ...fromBlocks].filter((t) => t.startsWith("Tf"));
};

const generateImports = (
  baseClass: string,
  baseConfig: string,
  block: SchemaBlock,
  includeProvider = false,
): string => {
  const baseTypes = ["Construct", "TokenValue", baseConfig];
  const providerTypes = includeProvider ? ["TerraformProvider"] : [];
  const tfTypes = collectTfTypes(block);
  const types = [...new Set([...baseTypes, ...providerTypes, ...tfTypes])].sort();

  const needsComputed = hasComputedBlockTypes(block) || hasComputedListObjectAttrs(block);
  const computedValues = needsComputed ? ["ComputedList", "ComputedObject"] : [];
  const values = [...new Set([baseClass, ...computedValues])].sort();

  return `import type { ${types.join(", ")} } from "tfts";
import { ${values.join(", ")} } from "tfts";`;
};

const generateConfigTypeWithName = (
  configTypeName: string,
  className: string,
  block: SchemaBlock,
  baseConfig: string,
  registry: TypeNameRegistry,
): string => {
  const attrProperties = Object.entries(block.attributes ?? {})
    .filter(([, attr]) => getComputedListObjectSchema(attr) === undefined)
    .map(([name, attr]) => {
      const tsName = snakeToCamelCase(name);
      const tsType = mapSchemaTypeToTsConfig(attr.type);
      const optional = isPropertyOptional(attr) ? "?" : "";
      return `  readonly ${tsName}${optional}: ${tsType};`;
    });

  const blockProperties = Object.entries(block.block_types ?? {}).map(([name, blockType]) => {
    const tsName = snakeToCamelCase(name);
    const baseName = `${className}${snakeToPascalCase(name)}`;
    const actualBlockTypeName = getBlockTypeName(registry, baseName);
    const propType = getBlockPropertyType(blockType, actualBlockTypeName);
    const optional = isBlockOptional(blockType) ? "?" : "";
    return `  readonly ${tsName}${optional}: ${propType};`;
  });

  const properties = [...attrProperties, ...blockProperties];

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
  const attrLines = Object.entries(block.attributes ?? {})
    .filter(([, attr]) => !getComputedListObjectSchema(attr))
    .map(([name]) => `      ${name}: config.${snakeToCamelCase(name)},`);

  const blockLines = Object.entries(block.block_types ?? {}).map(
    ([name]) => `      ${name}: config.${snakeToCamelCase(name)},`,
  );

  return [...attrLines, ...blockLines].join("\n");
};

const generateGetters = (block: SchemaBlock): string =>
  Object.entries(block.attributes ?? {})
    .filter(
      ([name, attr]) =>
        !RESERVED_NAMES.has(snakeToCamelCase(name)) && !getComputedListObjectSchema(attr),
    )
    .map(([name]) => {
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
  const outputClasses = generateOutputClasses(block, className, registry);
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
  const blockGetters = generateBlockGetters(block, className);

  const blockTypeCode =
    blockTypes.length > 0 ? blockTypes.map((bt) => bt.code).join("\n\n") + "\n\n" : "";

  const outputClassCode =
    outputClasses.length > 0 ? outputClasses.map((oc) => oc.code).join("\n\n") + "\n\n" : "";

  const allGetters = [getters, inputGetters, blockGetters].filter(Boolean).join("\n\n");
  const getterSection = allGetters ? `\n\n${allGetters}` : "";

  return `${imports}

${blockTypeCode}${outputClassCode}${configType}

export class ${className} extends TerraformResource {
  private readonly _config: ${className}Config;

  constructor(scope: Construct, id: string, config: ${className}Config) {
    super(scope, id, "${resourceName}", {
${constructorBody}
    }, config);
    this._config = config;
  }

  importFrom(resourceId: TfString): this {
    this.lifecycle = { ...this.lifecycle, importId: resourceId };
    return this;
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

type FileEntry = readonly [string, string];
type GeneratorResult = {
  readonly files: readonly FileEntry[];
  readonly exports: readonly NamespaceExport[];
};

const generateResourceEntries = (
  name: string,
  schemas: Readonly<Record<string, { readonly block: SchemaBlock }>>,
): GeneratorResult => {
  const entries = Object.entries(schemas).map(([resourceName, resourceSchema]) => {
    const strippedName = stripProviderPrefix(resourceName, name);
    const kebabName = snakeToKebabCase(strippedName);
    const path = `${kebabName}/index.ts`;
    const file: FileEntry = [path, generateResourceClass(resourceName, name, resourceSchema.block)];
    const exp: NamespaceExport = {
      namespace: snakeToCamelCase(strippedName),
      path: `${kebabName}/index.js`,
    };
    return { file, exp };
  });
  return { files: entries.map((e) => e.file), exports: entries.map((e) => e.exp) };
};

const generateDataSourceEntries = (
  name: string,
  schemas: Readonly<Record<string, { readonly block: SchemaBlock }>>,
): GeneratorResult => {
  const entries = Object.entries(schemas).map(([dataSourceName, dataSourceSchema]) => {
    const strippedName = stripProviderPrefix(dataSourceName, name);
    const kebabName = snakeToKebabCase(strippedName);
    const path = `data-${kebabName}/index.ts`;
    const file: FileEntry = [
      path,
      generateDataSourceClass(dataSourceName, name, dataSourceSchema.block),
    ];
    const exp: NamespaceExport = {
      namespace: `data${snakeToPascalCase(strippedName)}`,
      path: `data-${kebabName}/index.js`,
    };
    return { file, exp };
  });
  return { files: entries.map((e) => e.file), exports: entries.map((e) => e.exp) };
};

export const generateProviderFiles = (name: string, schema: ProviderSchema): GeneratedFiles => {
  const providerEntry = Object.entries(schema.provider_schemas).find(
    ([source]) => source.includes(`/${name}`) || source.endsWith(`/${name}`),
  );

  if (providerEntry === undefined) {
    return new Map();
  }

  const [source, schemaEntry] = providerEntry;

  const providerFile: FileEntry = [
    "provider/index.ts",
    generateProviderClass(name, source, schemaEntry.provider.block),
  ];
  const providerExport: NamespaceExport = { namespace: "provider", path: "provider/index.js" };

  const resources =
    schemaEntry.resource_schemas !== undefined
      ? generateResourceEntries(name, schemaEntry.resource_schemas)
      : { files: [], exports: [] };

  const dataSources =
    schemaEntry.data_source_schemas !== undefined
      ? generateDataSourceEntries(name, schemaEntry.data_source_schemas)
      : { files: [], exports: [] };

  const allExports = [providerExport, ...resources.exports, ...dataSources.exports];
  const indexFile: FileEntry = ["index.ts", generateIndexFile(allExports)];

  const allFiles = [providerFile, ...resources.files, ...dataSources.files, indexFile];

  return new Map(allFiles);
};
