import { z } from "zod";

export type Token = RefToken | FnToken | RawToken | LazyToken;

export type RefToken = {
  readonly kind: "ref";
  readonly fqn: string;
  readonly attribute: string;
};

export type FnToken = {
  readonly kind: "fn";
  readonly name: string;
  readonly args: readonly unknown[];
};

export type RawToken = {
  readonly kind: "raw";
  readonly expression: string;
};

export type LazyToken = {
  readonly kind: "lazy";
  readonly producer: () => unknown;
};

const RefTokenSchema = z.object({
  kind: z.literal("ref"),
  fqn: z.string(),
  attribute: z.string(),
});

const FnTokenSchema = z.object({
  kind: z.literal("fn"),
  name: z.string(),
  args: z.array(z.unknown()).readonly(),
});

const RawTokenSchema = z.object({
  kind: z.literal("raw"),
  expression: z.string(),
});

const LazyTokenSchema = z.object({
  kind: z.literal("lazy"),
  producer: z.function(),
});

const TokenSchema: z.ZodType<Token> = z.union([
  RefTokenSchema,
  FnTokenSchema,
  RawTokenSchema,
  LazyTokenSchema,
]);

export type TokenResolver = (token: Token) => unknown;

export type TokenContext = {
  readonly stack: string;
  readonly resources: ReadonlyMap<string, string>;
};

export type IResolvable = {
  readonly creationStack: readonly string[];
  resolve(context: IResolveContext): unknown;
  toString(): string;
};

export type IResolveContext = {
  readonly scope: unknown;
  readonly preparing: boolean;
  readonly originStack: readonly string[];
  registerPostProcessor(postProcessor: IPostProcessor): void;
  resolve(value: unknown): unknown;
};

export type IPostProcessor = {
  postProcess(input: unknown, context: IResolveContext): unknown;
};

export type IStringProducer = {
  produce(context: IResolveContext): string | undefined;
};

export type INumberProducer = {
  produce(context: IResolveContext): number | undefined;
};

export type IListProducer = {
  produce(context: IResolveContext): string[] | undefined;
};

export type IAnyProducer = {
  produce(context: IResolveContext): unknown;
};

const TOKEN_MARKER = "${TfToken[";
const TOKEN_MARKER_END = "]}";

const NUMBER_TOKEN_MARKER = 0x48c00000;
const NUMBER_TOKEN_MASK = 0xffff0000;

const tokenMap = new Map<number, Token>();
let tokenCounter = 0;

export function createToken(token: Token): string {
  const id = tokenCounter++;
  tokenMap.set(id, token);
  return `${TOKEN_MARKER}${id}${TOKEN_MARKER_END}`;
}

export function createNumberToken(token: Token): number {
  const id = tokenCounter++;
  tokenMap.set(id, token);
  const encoded = (NUMBER_TOKEN_MARKER | id) >>> 0;
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(0, encoded, false);
  view.setUint32(4, 0, false);
  return view.getFloat64(0, false);
}

export function ref(fqn: string, attribute: string): RefToken {
  return { kind: "ref", fqn, attribute };
}

export function fn(name: string, ...args: readonly unknown[]): FnToken {
  return { kind: "fn", name, args };
}

export function raw(expression: string): RawToken {
  return { kind: "raw", expression };
}

export function lazy(producer: () => unknown): LazyToken {
  return { kind: "lazy", producer };
}

export function tokenToString(token: Token): string {
  switch (token.kind) {
    case "ref":
      return `\${${token.fqn}.${token.attribute}}`;
    case "fn":
      return `\${${token.name}(${token.args.map(argToString).join(", ")})}`;
    case "raw":
      return token.expression;
    case "lazy":
      return tokenToString(resolveToken(token));
  }
}

function argToString(arg: unknown): string {
  if (typeof arg === "string") {
    return `"${arg}"`;
  }
  if (typeof arg === "number" || typeof arg === "boolean") {
    return String(arg);
  }
  if (Array.isArray(arg)) {
    return `[${arg.map(argToString).join(", ")}]`;
  }
  if (arg !== null && typeof arg === "object") {
    const token = asToken(arg);
    if (token !== null) {
      return tokenToString(token);
    }
    const entries = Object.entries(arg);
    return `{${entries.map(([k, v]) => `${k} = ${argToString(v)}`).join(", ")}}`;
  }
  return String(arg);
}

export function asToken(value: unknown): Token | null {
  const result = TokenSchema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  return null;
}

export function containsTokens(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.includes(TOKEN_MARKER);
  }

  if (typeof value === "number") {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setFloat64(0, value, false);
    const high = view.getUint32(0, false);
    return (high & NUMBER_TOKEN_MASK) === NUMBER_TOKEN_MARKER;
  }

  if (asToken(value) !== null) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some(containsTokens);
  }

  if (typeof value === "object") {
    const obj = z.record(z.string(), z.unknown()).safeParse(value);
    if (obj.success) {
      return Object.values(obj.data).some(containsTokens);
    }
  }

  return false;
}

export function resolveToken(token: Token): Token {
  if (token.kind === "lazy") {
    const result = token.producer();
    const resultToken = asToken(result);
    if (resultToken !== null) {
      return resolveToken(resultToken);
    }
    return { kind: "raw", expression: String(result) };
  }
  return token;
}

export function resolveTokens(value: unknown, resolver: TokenResolver): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return resolveStringTokens(value, resolver);
  }

  if (typeof value === "number") {
    return resolveNumberToken(value, resolver);
  }

  const token = asToken(value);
  if (token !== null) {
    return resolver(token);
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveTokens(item, resolver));
  }

  if (typeof value === "object") {
    const obj = z.record(z.string(), z.unknown()).safeParse(value);
    if (obj.success) {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(obj.data)) {
        result[key] = resolveTokens(val, resolver);
      }
      return result;
    }
  }

  return value;
}

function resolveStringTokens(value: string, resolver: TokenResolver): unknown {
  const wrappedRegex = /\$\{TfToken\[(\d+)\]\}/g;
  const bareRegex = /TfToken\[(\d+)\]/g;

  const hasWrapped = wrappedRegex.test(value);
  const hasBare = bareRegex.test(value);

  if (!hasWrapped && !hasBare) {
    return value;
  }

  wrappedRegex.lastIndex = 0;
  bareRegex.lastIndex = 0;

  const regex = hasWrapped ? wrappedRegex : bareRegex;
  const isBareMatch = !hasWrapped && hasBare;
  let match: RegExpExecArray | null;
  let lastIndex = 0;
  const parts: unknown[] = [];

  while ((match = regex.exec(value)) !== null) {
    if (match.index > lastIndex) {
      parts.push(value.slice(lastIndex, match.index));
    }

    const tokenId = parseInt(match[1] ?? "0", 10);
    const token = tokenMap.get(tokenId);
    if (token) {
      let resolved = resolver(token);
      if (isBareMatch && typeof resolved === "string") {
        resolved = unwrapTerraformExpression(resolved);
      }
      if (typeof resolved === "string" && containsTokenPattern(resolved)) {
        parts.push(resolveStringTokens(resolved, resolver));
      } else {
        parts.push(resolved);
      }
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < value.length) {
    parts.push(value.slice(lastIndex));
  }

  if (parts.length === 0) {
    return value;
  }

  if (parts.length === 1 && lastIndex === value.length) {
    return parts[0];
  }

  const result = parts.map((p) => (typeof p === "string" ? p : String(p))).join("");
  if (containsTokenPattern(result)) {
    return resolveStringTokens(result, resolver);
  }
  return result;
}

function containsTokenPattern(value: string): boolean {
  return /\$\{TfToken\[\d+\]\}/.test(value) || /TfToken\[\d+\]/.test(value);
}

function unwrapTerraformExpression(expr: string): string {
  if (expr.startsWith("${") && expr.endsWith("}")) {
    return expr.slice(2, -1);
  }
  return expr;
}

function resolveNumberToken(value: number, resolver: TokenResolver): unknown {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, value, false);
  const high = view.getUint32(0, false);

  if ((high & NUMBER_TOKEN_MASK) !== NUMBER_TOKEN_MARKER) {
    return value;
  }

  const tokenId = high & ~NUMBER_TOKEN_MASK;
  const token = tokenMap.get(tokenId);
  if (token) {
    return resolver(token);
  }

  return value;
}
