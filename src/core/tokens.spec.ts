import { describe, expect, test } from "bun:test";
import {
  containsTokens,
  fn,
  raw,
  ref,
  RefToken,
  FnToken,
  RawToken,
  resolveTokens,
  tokenToHcl,
  Token,
} from "./tokens.js";

describe("ref", () => {
  test("creates ref token", () => {
    const token = ref("aws_instance.main", "id");
    expect(token).toBeInstanceOf(RefToken);
    expect(token.kind).toBe("ref");
    expect(token.fqn).toBe("aws_instance.main");
    expect(token.attribute).toBe("id");
  });
});

describe("fn", () => {
  test("creates fn token with no args", () => {
    const token = fn("timestamp");
    expect(token).toBeInstanceOf(FnToken);
    expect(token.kind).toBe("fn");
    expect(token.name).toBe("timestamp");
    expect(token.args).toEqual([]);
  });

  test("creates fn token with args", () => {
    const token = fn("join", ",", ["a", "b"]);
    expect(token).toBeInstanceOf(FnToken);
    expect(token.kind).toBe("fn");
    expect(token.name).toBe("join");
    expect(token.args).toEqual([",", ["a", "b"]]);
  });
});

describe("raw", () => {
  test("creates raw token", () => {
    const token = raw("${local.my_value}");
    expect(token).toBeInstanceOf(RawToken);
    expect(token.kind).toBe("raw");
    expect(token.expression).toBe("${local.my_value}");
  });
});

describe("tokenToHcl", () => {
  test("converts ref token", () => {
    const token = ref("aws_instance.main", "id");
    expect(tokenToHcl(token)).toBe("${aws_instance.main.id}");
  });

  test("converts fn token with no args", () => {
    const token = fn("timestamp");
    expect(tokenToHcl(token)).toBe("${timestamp()}");
  });

  test("converts fn token with string args", () => {
    const token = fn("join", ",", "a", "b");
    expect(tokenToHcl(token)).toBe('${join(",", "a", "b")}');
  });

  test("converts fn token with number args", () => {
    const token = fn("max", 1, 2, 3);
    expect(tokenToHcl(token)).toBe("${max(1, 2, 3)}");
  });

  test("converts fn token with nested token arg", () => {
    const inner = ref("var.list", "value");
    const token = fn("length", inner);
    expect(tokenToHcl(token)).toBe("${length(${var.list.value})}");
  });

  test("converts raw token", () => {
    const token = raw("${local.value}");
    expect(tokenToHcl(token)).toBe("${local.value}");
  });
});

describe("containsTokens", () => {
  test("returns true for token", () => {
    expect(containsTokens(ref("a", "b"))).toBe(true);
  });

  test("returns false for primitive", () => {
    expect(containsTokens("string")).toBe(false);
    expect(containsTokens(42)).toBe(false);
    expect(containsTokens(true)).toBe(false);
    expect(containsTokens(null)).toBe(false);
  });

  test("returns true for array containing token", () => {
    expect(containsTokens([1, ref("a", "b"), 3])).toBe(true);
  });

  test("returns false for array without tokens", () => {
    expect(containsTokens([1, 2, 3])).toBe(false);
  });

  test("returns true for object containing token", () => {
    expect(containsTokens({ key: ref("a", "b") })).toBe(true);
  });

  test("returns false for object without tokens", () => {
    expect(containsTokens({ key: "value" })).toBe(false);
  });

  test("returns true for deeply nested token", () => {
    expect(containsTokens({ a: { b: { c: [ref("x", "y")] } } })).toBe(true);
  });
});

describe("resolveTokens", () => {
  const resolver = (token: Token): string => {
    if (token instanceof RefToken) {
      return `resolved:${token.fqn}.${token.attribute}`;
    }
    return "resolved";
  };

  test("resolves single token", () => {
    const result = resolveTokens(ref("a", "b"), resolver);
    expect(result).toBe("resolved:a.b");
  });

  test("returns primitive unchanged", () => {
    expect(resolveTokens("string", resolver)).toBe("string");
    expect(resolveTokens(42, resolver)).toBe(42);
    expect(resolveTokens(true, resolver)).toBe(true);
    expect(resolveTokens(null, resolver)).toBe(null);
  });

  test("resolves tokens in array", () => {
    const result = resolveTokens([1, ref("a", "b"), 3], resolver);
    expect(result).toEqual([1, "resolved:a.b", 3]);
  });

  test("resolves tokens in object", () => {
    const result = resolveTokens({ key: ref("a", "b"), other: "value" }, resolver);
    expect(result).toEqual({ key: "resolved:a.b", other: "value" });
  });

  test("resolves deeply nested tokens", () => {
    const result = resolveTokens({ a: { b: [ref("x", "y")] } }, resolver);
    expect(result).toEqual({ a: { b: ["resolved:x.y"] } });
  });
});
