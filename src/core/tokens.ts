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

// TokenValue<T>: opaque wrapper for deferred values with phantom type for type safety
// No primitive methods exposed - prevents misuse like .toUpperCase() or arithmetic
export class TokenValue<T> {
  private readonly _token: Token;
  private declare readonly _phantom: T;

  constructor(token: Token) {
    this._token = token;
  }

  toString(): string {
    return this._token.toHcl();
  }

  toToken(): Token {
    return this._token;
  }
}

// Union types for construct config arguments
export type TfString = string | TokenValue<string>;
export type TfNumber = number | TokenValue<number>;
export type TfBoolean = boolean | TokenValue<boolean>;
export type TfStringMap =
  | Readonly<Record<string, string>>
  | TokenValue<Readonly<Record<string, string>>>;

// ComputedList: accessor for computed list blocks with .get(index) method
export class ComputedList<T> {
  constructor(
    private readonly _fqn: string,
    private readonly _attribute: string,
    private readonly _elementFactory: (fqn: string, attribute: string) => T,
  ) {}

  get(index: number): T {
    return this._elementFactory(this._fqn, `${this._attribute}.${index}`);
  }
}

// ComputedObject: accessor for computed nested object blocks
export class ComputedObject {
  constructor(
    protected readonly _fqn: string,
    protected readonly _basePath: string,
  ) {}

  protected _getStringAttribute(name: string): TokenValue<string> {
    const path = this._basePath ? `${this._basePath}.${name}` : name;
    return new TokenValue(new RefToken(this._fqn, path));
  }

  protected _getNumberAttribute(name: string): TokenValue<number> {
    const path = this._basePath ? `${this._basePath}.${name}` : name;
    return new TokenValue(new RefToken(this._fqn, path));
  }

  protected _getBooleanAttribute(name: string): TokenValue<boolean> {
    const path = this._basePath ? `${this._basePath}.${name}` : name;
    return new TokenValue(new RefToken(this._fqn, path));
  }
}
