export type TerraformValue =
  | string
  | number
  | boolean
  | null
  | Token
  | readonly TerraformValue[]
  | { readonly [key: string]: TerraformValue };

export abstract class Token {
  abstract readonly kind: "ref" | "fn" | "raw";
  abstract toHcl(): string;
}

export class RefToken extends Token {
  readonly kind = "ref" as const;

  constructor(
    readonly fqn: string,
    readonly attribute: string,
  ) {
    super();
  }

  toHcl(): string {
    return `\${${this.fqn}.${this.attribute}}`;
  }
}

export class FnToken extends Token {
  readonly kind = "fn" as const;

  constructor(
    readonly name: string,
    readonly args: readonly TerraformValue[],
  ) {
    super();
  }

  toHcl(): string {
    return `\${${this.name}(${this.args.map(hclEncodeValue).join(", ")})}`;
  }
}

export class RawToken extends Token {
  readonly kind = "raw" as const;

  constructor(readonly expression: string) {
    super();
  }

  toHcl(): string {
    return this.expression;
  }
}

export type TokenResolver = (token: Token) => TerraformValue;

export const TOKEN_SYMBOL: unique symbol = Symbol.for("tfts/Token");

export type TokenBox = {
  readonly [TOKEN_SYMBOL]: true;
  readonly token: Token;
};

export type TokenValue<T> = TokenBox & { readonly _phantom?: T };

export const ref = (fqn: string, attribute: string): RefToken => new RefToken(fqn, attribute);

export const fn = (name: string, ...args: readonly TerraformValue[]): FnToken =>
  new FnToken(name, args);

export const raw = (expression: string): RawToken => new RawToken(expression);

const hclEncodeValue = (value: TerraformValue): string => {
  if (value === null) return "null";
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Token) return value.toHcl();
  if (Array.isArray(value)) return `[${value.map(hclEncodeValue).join(", ")}]`;
  const entries = Object.entries(value);
  return `{${entries.map(([k, v]) => `${k} = ${hclEncodeValue(v)}`).join(", ")}}`;
};

export const tokenToHcl = (token: Token): string => token.toHcl();

export const containsTokens = (value: TerraformValue): boolean => {
  if (value instanceof Token) return true;
  if (Array.isArray(value)) return value.some(containsTokens);
  if (typeof value === "object" && value !== null) {
    return Object.values(value).some(containsTokens);
  }
  return false;
};

export const resolveTokens = (value: TerraformValue, resolver: TokenResolver): TerraformValue => {
  if (value instanceof Token) return resolver(value);
  if (Array.isArray(value)) {
    return value.map((v: TerraformValue) => resolveTokens(v, resolver));
  }
  if (typeof value === "object" && value !== null) {
    const result: Record<string, TerraformValue> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = resolveTokens(v, resolver);
    }
    return result;
  }
  return value;
};
