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

export type TokenResolver = (token: Token) => unknown;

export type TokenContext = {
  readonly stack: string;
  readonly resources: ReadonlyMap<string, string>;
};

export interface IResolvable {
  readonly creationStack: readonly string[];
  resolve(context: IResolveContext): unknown;
  toString(): string;
}

export interface IResolveContext {
  readonly scope: unknown;
  readonly preparing: boolean;
  readonly originStack: readonly string[];
  registerPostProcessor(postProcessor: IPostProcessor): void;
  resolve(value: unknown): unknown;
}

export interface IPostProcessor {
  postProcess(input: unknown, context: IResolveContext): unknown;
}

export interface IStringProducer {
  produce(context: IResolveContext): string | undefined;
}

export interface INumberProducer {
  produce(context: IResolveContext): number | undefined;
}

export interface IListProducer {
  produce(context: IResolveContext): string[] | undefined;
}

export interface IAnyProducer {
  produce(context: IResolveContext): unknown;
}

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

export function ref(fqn: string, attribute: string): Token {
  return { kind: "ref", fqn, attribute };
}

export function fn(name: string, ...args: readonly unknown[]): Token {
  return { kind: "fn", name, args };
}

export function raw(expression: string): Token {
  return { kind: "raw", expression };
}

export function lazy(producer: () => unknown): Token {
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
    if (isToken(arg)) {
      return tokenToString(arg as Token);
    }
    const entries = Object.entries(arg as Record<string, unknown>);
    return `{${entries.map(([k, v]) => `${k} = ${argToString(v)}`).join(", ")}}`;
  }
  return String(arg);
}

export function isToken(value: unknown): value is Token {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    obj["kind"] === "ref" || obj["kind"] === "fn" || obj["kind"] === "raw" || obj["kind"] === "lazy"
  );
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

  if (isToken(value)) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some(containsTokens);
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(containsTokens);
  }

  return false;
}

export function resolveToken(token: Token): Token {
  if (token.kind === "lazy") {
    const result = token.producer();
    if (isToken(result)) {
      return resolveToken(result);
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

  if (isToken(value)) {
    return resolver(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveTokens(item, resolver));
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = resolveTokens(val, resolver);
    }
    return result;
  }

  return value;
}

function resolveStringTokens(value: string, resolver: TokenResolver): unknown {
  const regex = /\$\{TfToken\[(\d+)\]\}/g;
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
      parts.push(resolver(token));
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

  return parts.map((p) => (typeof p === "string" ? p : String(p))).join("");
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
