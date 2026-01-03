export type Token =
  | { readonly kind: "ref"; readonly fqn: string; readonly attribute: string }
  | { readonly kind: "fn"; readonly name: string; readonly args: readonly unknown[] }
  | { readonly kind: "raw"; readonly expression: string };

export type RefToken = Extract<Token, { kind: "ref" }>;
export type FnToken = Extract<Token, { kind: "fn" }>;
export type RawToken = Extract<Token, { kind: "raw" }>;

export type TokenResolver = (token: Token) => unknown;

export const TOKEN_SYMBOL: unique symbol = Symbol.for("tfts/Token");

export type TokenValue<T> = {
  readonly [TOKEN_SYMBOL]: true;
  readonly token: Token;
  readonly _phantom?: T;
};
