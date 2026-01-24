import { describe, expect, test } from "bun:test";
import { resolveTokens, type Token, tokenToString } from "../core/tokens.js";
import { Fn, Op } from "./terraform-functions.js";

function resolveFn(value: string): string {
  const result = resolveTokens(value, (token: Token) => tokenToString(token));
  if (typeof result !== "string") {
    return String(result);
  }
  return result;
}

describe("Fn", () => {
  describe("Numeric Functions", () => {
    test("abs", () => {
      const result = resolveFn(Fn.abs(-5));
      expect(result).toBe("${abs(-5)}");
    });

    test("ceil", () => {
      const result = resolveFn(Fn.ceil(4.3));
      expect(result).toBe("${ceil(4.3)}");
    });

    test("floor", () => {
      const result = resolveFn(Fn.floor(4.9));
      expect(result).toBe("${floor(4.9)}");
    });

    test("max", () => {
      const result = resolveFn(Fn.max([1, 2, 3]));
      expect(result).toBe("${max(1, 2, 3)}");
    });

    test("min", () => {
      const result = resolveFn(Fn.min([1, 2, 3]));
      expect(result).toBe("${min(1, 2, 3)}");
    });
  });

  describe("String Functions", () => {
    test("join", () => {
      const result = resolveFn(Fn.join(",", ["a", "b", "c"]));
      expect(result).toBe('${join(",", ["a", "b", "c"])}');
    });

    test("split", () => {
      const result = resolveFn(Fn.split(",", "a,b,c"));
      expect(result).toBe('${split(",", "a,b,c")}');
    });

    test("lower", () => {
      const result = resolveFn(Fn.lower("HELLO"));
      expect(result).toBe('${lower("HELLO")}');
    });

    test("upper", () => {
      const result = resolveFn(Fn.upper("hello"));
      expect(result).toBe('${upper("hello")}');
    });

    test("replace", () => {
      const result = resolveFn(Fn.replace("hello", "l", "L"));
      expect(result).toBe('${replace("hello", "l", "L")}');
    });

    test("format", () => {
      const result = resolveFn(Fn.format("Hello, %s!", "World"));
      expect(result).toBe('${format("Hello, %s!", "World")}');
    });
  });

  describe("Collection Functions", () => {
    test("length", () => {
      const result = resolveFn(Fn.length([1, 2, 3]));
      expect(result).toBe("${length([1, 2, 3])}");
    });

    test("contains", () => {
      const result = resolveFn(Fn.contains(["a", "b", "c"], "b"));
      expect(result).toBe('${contains(["a", "b", "c"], "b")}');
    });

    test("concat", () => {
      const result = resolveFn(Fn.concat([1, 2], [3, 4]));
      expect(result).toBe("${concat([1, 2], [3, 4])}");
    });

    test("flatten", () => {
      const result = resolveFn(
        Fn.flatten([
          [1, 2],
          [3, 4],
        ]),
      );
      expect(result).toBe("${flatten([[1, 2], [3, 4]])}");
    });

    test("keys", () => {
      const result = resolveFn(Fn.keys({ a: 1, b: 2 }));
      expect(result).toBe("${keys({a = 1, b = 2})}");
    });

    test("values", () => {
      const result = resolveFn(Fn.values({ a: 1, b: 2 }));
      expect(result).toBe("${values({a = 1, b = 2})}");
    });

    test("merge", () => {
      const result = resolveFn(Fn.merge({ a: 1 }, { b: 2 }));
      expect(result).toBe("${merge({a = 1}, {b = 2})}");
    });

    test("lookup with default", () => {
      const result = resolveFn(Fn.lookup({ a: 1 }, "a", 0));
      expect(result).toBe('${lookup({a = 1}, "a", 0)}');
    });

    test("toset", () => {
      const result = resolveFn(Fn.toset([1, 2, 3]));
      expect(result).toBe("${toset([1, 2, 3])}");
    });

    test("tolist", () => {
      const result = resolveFn(Fn.tolist([1, 2, 3]));
      expect(result).toBe("${tolist([1, 2, 3])}");
    });

    test("tomap", () => {
      const result = resolveFn(Fn.tomap({ a: 1 }));
      expect(result).toBe("${tomap({a = 1})}");
    });
  });

  describe("Encoding Functions", () => {
    test("jsonencode", () => {
      const result = resolveFn(Fn.jsonencode({ key: "value" }));
      expect(result).toBe('${jsonencode({key = "value"})}');
    });

    test("jsondecode", () => {
      const result = resolveFn(Fn.jsondecode('{"key": "value"}'));
      expect(result).toBe('${jsondecode("{"key": "value"}")}');
    });

    test("base64encode", () => {
      const result = resolveFn(Fn.base64encode("hello"));
      expect(result).toBe('${base64encode("hello")}');
    });

    test("base64decode", () => {
      const result = resolveFn(Fn.base64decode("aGVsbG8="));
      expect(result).toBe('${base64decode("aGVsbG8=")}');
    });
  });

  describe("Filesystem Functions", () => {
    test("file", () => {
      const result = resolveFn(Fn.file("./test.txt"));
      expect(result).toBe('${file("./test.txt")}');
    });

    test("fileexists", () => {
      const result = resolveFn(Fn.fileexists("./test.txt"));
      expect(result).toBe('${fileexists("./test.txt")}');
    });

    test("templatefile", () => {
      const result = resolveFn(Fn.templatefile("./template.tpl", { name: "world" }));
      expect(result).toBe('${templatefile("./template.tpl", {name = "world"})}');
    });

    test("abspath", () => {
      const result = resolveFn(Fn.abspath("./test"));
      expect(result).toBe('${abspath("./test")}');
    });
  });

  describe("Hash Functions", () => {
    test("md5", () => {
      const result = resolveFn(Fn.md5("hello"));
      expect(result).toBe('${md5("hello")}');
    });

    test("sha256", () => {
      const result = resolveFn(Fn.sha256("hello"));
      expect(result).toBe('${sha256("hello")}');
    });

    test("uuid", () => {
      const result = resolveFn(Fn.uuid());
      expect(result).toBe("${uuid()}");
    });
  });

  describe("IP Network Functions", () => {
    test("cidrsubnet", () => {
      const result = resolveFn(Fn.cidrsubnet("10.0.0.0/16", 8, 1));
      expect(result).toBe('${cidrsubnet("10.0.0.0/16", 8, 1)}');
    });

    test("cidrhost", () => {
      const result = resolveFn(Fn.cidrhost("10.0.0.0/24", 5));
      expect(result).toBe('${cidrhost("10.0.0.0/24", 5)}');
    });
  });

  describe("Type Conversion Functions", () => {
    test("tostring", () => {
      const result = resolveFn(Fn.tostring(123));
      expect(result).toBe("${tostring(123)}");
    });

    test("tonumber", () => {
      const result = resolveFn(Fn.tonumber("123"));
      expect(result).toBe('${tonumber("123")}');
    });

    test("tobool", () => {
      const result = resolveFn(Fn.tobool("true"));
      expect(result).toBe('${tobool("true")}');
    });
  });

  describe("Date/Time Functions", () => {
    test("timestamp", () => {
      const result = resolveFn(Fn.timestamp());
      expect(result).toBe("${timestamp()}");
    });

    test("formatdate", () => {
      const result = resolveFn(Fn.formatdate("YYYY-MM-DD", "2023-01-01T00:00:00Z"));
      expect(result).toBe('${formatdate("YYYY-MM-DD", "2023-01-01T00:00:00Z")}');
    });

    test("timeadd", () => {
      const result = resolveFn(Fn.timeadd("2023-01-01T00:00:00Z", "24h"));
      expect(result).toBe('${timeadd("2023-01-01T00:00:00Z", "24h")}');
    });
  });

  describe("Conditional", () => {
    test("conditional with simple values", () => {
      const result = resolveFn(Fn.conditional(true, "yes", "no"));
      expect(result).toBe('${true ? "yes" : "no"}');
    });
  });

  describe("try and can", () => {
    test("try", () => {
      const result = resolveFn(Fn.try("value1", "fallback"));
      expect(result).toBe('${try("value1", "fallback")}');
    });

    test("can", () => {
      const result = resolveFn(Fn.can("expression"));
      expect(result).toBe('${can("expression")}');
    });
  });
});

describe("Op", () => {
  describe("Arithmetic operators", () => {
    test("add", () => {
      const result = resolveFn(Op.add(1, 2));
      expect(result).toBe("${(1 + 2)}");
    });

    test("sub", () => {
      const result = resolveFn(Op.sub(5, 3));
      expect(result).toBe("${(5 - 3)}");
    });

    test("mul", () => {
      const result = resolveFn(Op.mul(2, 3));
      expect(result).toBe("${(2 * 3)}");
    });

    test("div", () => {
      const result = resolveFn(Op.div(10, 2));
      expect(result).toBe("${(10 / 2)}");
    });

    test("mod", () => {
      const result = resolveFn(Op.mod(10, 3));
      expect(result).toBe("${(10 % 3)}");
    });

    test("negate", () => {
      const result = resolveFn(Op.negate(5));
      expect(result).toBe("${-5}");
    });
  });

  describe("Comparison operators", () => {
    test("eq", () => {
      const result = resolveFn(Op.eq(1, 1));
      expect(result).toBe("${(1 == 1)}");
    });

    test("neq", () => {
      const result = resolveFn(Op.neq(1, 2));
      expect(result).toBe("${(1 != 2)}");
    });

    test("gt", () => {
      const result = resolveFn(Op.gt(2, 1));
      expect(result).toBe("${(2 > 1)}");
    });

    test("gte", () => {
      const result = resolveFn(Op.gte(2, 2));
      expect(result).toBe("${(2 >= 2)}");
    });

    test("lt", () => {
      const result = resolveFn(Op.lt(1, 2));
      expect(result).toBe("${(1 < 2)}");
    });

    test("lte", () => {
      const result = resolveFn(Op.lte(2, 2));
      expect(result).toBe("${(2 <= 2)}");
    });
  });

  describe("Logical operators", () => {
    test("and", () => {
      const result = resolveFn(Op.and(true, false));
      expect(result).toBe("${(true && false)}");
    });

    test("or", () => {
      const result = resolveFn(Op.or(true, false));
      expect(result).toBe("${(true || false)}");
    });

    test("not", () => {
      const result = resolveFn(Op.not(true));
      expect(result).toBe("${!true}");
    });
  });
});
