import type { Attribute, AttributeType, Block, BlockType } from "./schema.js";

export function attributeTypeToTS(type: AttributeType | undefined): string {
  if (type === undefined) return "unknown";

  if (typeof type === "string") {
    switch (type) {
      case "string":
        return "string";
      case "number":
        return "number";
      case "bool":
        return "boolean";
      case "dynamic":
        return "unknown";
    }
  }

  const [container, inner] = type;

  switch (container) {
    case "list":
    case "set":
      return `${attributeTypeToTS(inner)}[]`;
    case "map":
      return `Record<string, ${attributeTypeToTS(inner)}>`;
    case "object":
      return `{ ${Object.entries(inner)
        .map(([k, v]) => `${safeName(k)}?: ${attributeTypeToTS(v)}`)
        .join("; ")} }`;
    case "tuple":
      return `[${inner.map(attributeTypeToTS).join(", ")}]`;
  }
}

export function attributeToConfigProperty(name: string, attr: Attribute): string {
  const tsType = attributeTypeToTS(attr.type);
  const isOptional = attr.required !== true || attr.optional === true || attr.computed === true;
  const optionalMark = isOptional ? "?" : "";
  const readonlyMark = "readonly ";
  return `${readonlyMark}${safeName(name)}${optionalMark}: ${tsType};`;
}

export function blockToConfigProperty(name: string, block: BlockType): string {
  const innerType = blockToInterfaceName(name);
  const isArray = block.nesting_mode === "list" || block.nesting_mode === "set";
  const isOptional = (block.min_items ?? 0) === 0;
  const optionalMark = isOptional ? "?" : "";
  const tsType = isArray ? `${innerType}[]` : innerType;
  return `readonly ${safeName(name)}${optionalMark}: ${tsType};`;
}

export function blockToInterfaceName(name: string): string {
  return toPascalCase(name);
}

export function safeName(name: string): string {
  const reserved = [
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "else",
    "enum",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "function",
    "if",
    "import",
    "in",
    "instanceof",
    "new",
    "null",
    "return",
    "super",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "typeof",
    "var",
    "void",
    "while",
    "with",
    "yield",
  ];
  if (reserved.includes(name)) {
    return `${name}_`;
  }
  if (/^\d/.test(name)) {
    return `_${name}`;
  }
  return name;
}

export function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function generateBlockInterface(name: string, block: Block): string {
  const interfaceName = blockToInterfaceName(name);
  const properties: string[] = [];

  if (block.attributes) {
    for (const [attrName, attr] of Object.entries(block.attributes)) {
      properties.push(`  ${attributeToConfigProperty(attrName, attr)}`);
    }
  }

  if (block.block_types) {
    for (const [blockName, blockType] of Object.entries(block.block_types)) {
      properties.push(`  ${blockToConfigProperty(blockName, blockType)}`);
    }
  }

  return `export type ${interfaceName} = {\n${properties.join("\n")}\n};`;
}
