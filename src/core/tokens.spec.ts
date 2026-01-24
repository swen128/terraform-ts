import { describe, expect, test } from "bun:test";
import {
  asToken,
  containsTokens,
  createToken,
  fn,
  lazy,
  raw,
  ref,
  resolveTokens,
  tokenToString,
} from "./tokens.js";

describe("tokens", () => {
  describe("ref", () => {
    test("creates ref token", () => {
      const token = ref("aws_instance.main", "id");

      expect(token.kind).toBe("ref");
      expect(token.fqn).toBe("aws_instance.main");
      expect(token.attribute).toBe("id");
    });
  });

  describe("fn", () => {
    test("creates fn token", () => {
      const token = fn("join", ",", ["a", "b"]);

      expect(token.kind).toBe("fn");
      expect(token.name).toBe("join");
      expect(token.args).toEqual([",", ["a", "b"]]);
    });
  });

  describe("raw", () => {
    test("creates raw token", () => {
      const token = raw("${var.foo}");

      expect(token.kind).toBe("raw");
      expect(token.expression).toBe("${var.foo}");
    });
  });

  describe("lazy", () => {
    test("creates lazy token", () => {
      const token = lazy(() => "computed");

      expect(token.kind).toBe("lazy");
      expect(typeof token.producer).toBe("function");
    });
  });

  describe("tokenToString", () => {
    test("converts ref token", () => {
      const token = ref("aws_instance.main", "id");
      expect(tokenToString(token)).toBe("${aws_instance.main.id}");
    });

    test("converts fn token", () => {
      const token = fn("upper", "hello");
      expect(tokenToString(token)).toBe('${upper("hello")}');
    });

    test("converts raw token", () => {
      const token = raw("${var.foo}");
      expect(tokenToString(token)).toBe("${var.foo}");
    });

    test("resolves lazy token", () => {
      const token = lazy(() => raw("${local.value}"));
      expect(tokenToString(token)).toBe("${local.value}");
    });
  });

  describe("asToken", () => {
    test("returns token for valid tokens", () => {
      expect(asToken(ref("a", "b"))).not.toBeNull();
      expect(asToken(fn("f"))).not.toBeNull();
      expect(asToken(raw("x"))).not.toBeNull();
      expect(asToken(lazy(() => null))).not.toBeNull();
    });

    test("returns null for non-tokens", () => {
      expect(asToken(null)).toBeNull();
      expect(asToken("string")).toBeNull();
      expect(asToken(123)).toBeNull();
      expect(asToken({ kind: "other" })).toBeNull();
    });
  });

  describe("createToken and containsTokens", () => {
    test("creates string token and detects it", () => {
      const token = ref("res", "attr");
      const str = createToken(token);

      expect(typeof str).toBe("string");
      expect(containsTokens(str)).toBe(true);
    });

    test("detects tokens in nested objects", () => {
      const token = ref("res", "attr");
      const str = createToken(token);
      const obj = { nested: { value: str } };

      expect(containsTokens(obj)).toBe(true);
    });

    test("returns false for plain values", () => {
      expect(containsTokens("plain string")).toBe(false);
      expect(containsTokens(42)).toBe(false);
      expect(containsTokens({ a: 1 })).toBe(false);
    });
  });

  describe("resolveTokens", () => {
    test("resolves tokens in object", () => {
      const token = ref("aws_instance.main", "id");
      const str = createToken(token);

      const result = resolveTokens({ value: str }, (t) => tokenToString(t));

      expect(result).toEqual({ value: "${aws_instance.main.id}" });
    });

    test("resolves tokens in array", () => {
      const token = ref("res", "attr");
      const str = createToken(token);

      const result = resolveTokens([str, "plain"], (t) => tokenToString(t));

      expect(result).toEqual(["${res.attr}", "plain"]);
    });

    test("passes through non-token values", () => {
      const result = resolveTokens({ a: 1, b: "str" }, (t) => tokenToString(t));

      expect(result).toEqual({ a: 1, b: "str" });
    });
  });
});
