import { z } from "zod";

type ParameterType =
  | "string"
  | "number"
  | "bool"
  | "dynamic"
  | readonly ["list", ParameterType]
  | readonly ["set", ParameterType]
  | readonly ["map", ParameterType]
  | readonly ["object", Readonly<Record<string, ParameterType>>]
  | readonly ["tuple", readonly ParameterType[]];

const ParameterTypeSchema: z.ZodType<ParameterType> = z.lazy(() =>
  z.union([
    z.literal("string"),
    z.literal("number"),
    z.literal("bool"),
    z.literal("dynamic"),
    z.tuple([z.literal("list"), ParameterTypeSchema]),
    z.tuple([z.literal("set"), ParameterTypeSchema]),
    z.tuple([z.literal("map"), ParameterTypeSchema]),
    z.tuple([z.literal("object"), z.record(z.string(), ParameterTypeSchema)]),
    z.tuple([z.literal("tuple"), z.array(ParameterTypeSchema)]),
  ]),
);

const FunctionParameterSchema = z.object({
  name: z.string(),
  type: ParameterTypeSchema,
});

const FunctionSignatureSchema = z.object({
  description: z.string(),
  return_type: ParameterTypeSchema,
  parameters: z.array(FunctionParameterSchema).optional(),
  variadic_parameter: FunctionParameterSchema.optional(),
});

type FunctionSignature = z.infer<typeof FunctionSignatureSchema>;

const FunctionsMetadataSchema = z.object({
  format_version: z.string(),
  function_signatures: z.record(z.string(), FunctionSignatureSchema),
});

export type FunctionsMetadata = z.infer<typeof FunctionsMetadataSchema>;

export const parseFunctionsMetadata = (data: unknown): FunctionsMetadata =>
  FunctionsMetadataSchema.parse(data);

const mapParamTypeToTs = (type: ParameterType): string => {
  if (type === "string") return "TfString";
  if (type === "number") return "TfNumber";
  if (type === "bool") return "TfBoolean";
  if (type === "dynamic") return "TerraformValue";

  const [container, inner] = type;
  if (container === "list" || container === "set") {
    return `readonly ${mapParamTypeToTs(inner)}[]`;
  }
  if (container === "map") {
    return `Readonly<Record<string, ${mapParamTypeToTs(inner)}>>`;
  }
  return "TerraformValue";
};

const mapReturnTypeToTs = (type: ParameterType): string => {
  const innerType = (t: ParameterType): string => {
    if (t === "string") return "string";
    if (t === "number") return "number";
    if (t === "bool") return "boolean";
    if (t === "dynamic") return "any";

    const [container, inner] = t;
    if (container === "list" || container === "set") {
      return `${innerType(inner)}[]`;
    }
    if (container === "map") {
      return `Record<string, ${innerType(inner)}>`;
    }
    return "unknown";
  };

  return `TokenValue<${innerType(type)}>`;
};

const escapeDescription = (desc: string): string =>
  desc.replace(/\*\//g, "* /").replace(/\n/g, "\n   * ");

const RESERVED_WORDS = new Set([
  "break",
  "case",
  "catch",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "finally",
  "for",
  "function",
  "if",
  "in",
  "instanceof",
  "new",
  "return",
  "switch",
  "this",
  "throw",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "class",
  "const",
  "enum",
  "export",
  "extends",
  "import",
  "super",
  "implements",
  "interface",
  "let",
  "package",
  "private",
  "protected",
  "public",
  "static",
  "yield",
]);

const safeParamName = (name: string): string => (RESERVED_WORDS.has(name) ? `${name}_` : name);

type UnwrapResult = { readonly expr: string; readonly nextCounter: number };

const generateUnwrap = (expr: string, type: ParameterType, counter: number): UnwrapResult => {
  if (type === "string" || type === "number" || type === "bool" || type === "dynamic") {
    return {
      expr: `${expr} instanceof TokenValue ? ${expr}.toToken() : ${expr}`,
      nextCounter: counter,
    };
  }

  const [container, inner] = type;
  if (container === "list" || container === "set") {
    const varName = `v${counter}`;
    const { expr: innerExpr, nextCounter } = generateUnwrap(varName, inner, counter + 1);
    return { expr: `${expr}.map(${varName} => ${innerExpr})`, nextCounter };
  }
  if (container === "map") {
    const keyName = `k${counter}`;
    const varName = `v${counter}`;
    const { expr: innerExpr, nextCounter } = generateUnwrap(varName, inner, counter + 1);
    return {
      expr: `Object.fromEntries(Object.entries(${expr}).map(([${keyName}, ${varName}]) => [${keyName}, ${innerExpr}]))`,
      nextCounter,
    };
  }
  return { expr, nextCounter: counter };
};

const generateMethod = (name: string, sig: FunctionSignature): string => {
  const params = sig.parameters ?? [];

  const paramList = [
    ...params.map((p) => `${safeParamName(p.name)}: ${mapParamTypeToTs(p.type)}`),
    ...(sig.variadic_parameter
      ? [
          `...${safeParamName(sig.variadic_parameter.name)}: ${mapParamTypeToTs(sig.variadic_parameter.type)}[]`,
        ]
      : []),
  ];

  const initial: { statements: readonly string[]; args: readonly string[]; counter: number } = {
    statements: [],
    args: [],
    counter: 0,
  };

  const {
    statements,
    args,
    counter: finalCounter,
  } = params.reduce((acc, p) => {
    const paramName = safeParamName(p.name);
    const unwrappedName = `_${paramName}`;
    const { expr, nextCounter } = generateUnwrap(paramName, p.type, acc.counter);
    return {
      statements: [...acc.statements, `const ${unwrappedName} = ${expr};`],
      args: [...acc.args, unwrappedName],
      counter: nextCounter,
    };
  }, initial);

  const [allStatements, allArgs] = sig.variadic_parameter
    ? [
        [
          ...statements,
          `const _${safeParamName(sig.variadic_parameter.name)} = ${safeParamName(sig.variadic_parameter.name)}.map(v => ${generateUnwrap("v", sig.variadic_parameter.type, finalCounter).expr});`,
        ],
        [...args, `..._${safeParamName(sig.variadic_parameter.name)}`],
      ]
    : [statements, args];

  const fnCall = allArgs.length > 0 ? `fn("${name}", ${allArgs.join(", ")})` : `fn("${name}")`;
  const returnType = mapReturnTypeToTs(sig.return_type);
  const body =
    allStatements.length > 0
      ? `${allStatements.join("\n    ")}\n    return new TokenValue(${fnCall});`
      : `return new TokenValue(${fnCall});`;

  return `  /**
   * ${escapeDescription(sig.description)}
   * @see https://developer.hashicorp.com/terraform/language/functions/${name}
   */
  static ${name}(${paramList.join(", ")}): ${returnType} {
    ${body}
  }`;
};

export const generateFnClass = (metadata: FunctionsMetadata): string => {
  const methods = Object.entries(metadata.function_signatures)
    .filter(([name]) => !name.includes("::"))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, sig]) => generateMethod(name, sig))
    .join("\n\n");

  return `/**
 * Generated by scripts/generate-fn.ts - do not edit manually.
 * Regenerate: bun run generate:fn
 */

import type { TfString, TfNumber, TfBoolean, TerraformValue } from "../core/tokens.js";
import { fn, TokenValue } from "../core/tokens.js";

export class Fn {
${methods}
}
`;
};
