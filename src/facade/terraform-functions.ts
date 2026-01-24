import { createToken, fn, raw } from "../core/tokens.js";

type Expression = string | number | boolean | unknown[] | Record<string, unknown> | IResolvable;

interface IResolvable {
  resolve(context: unknown): unknown;
  toString(): string;
}

class FunctionCallExpression implements IResolvable {
  constructor(
    private readonly name: string,
    private readonly args: readonly unknown[],
  ) {}

  resolve(_context: unknown): string {
    return this.toTerraformExpression();
  }

  toString(): string {
    return createToken(fn(this.name, ...this.args));
  }

  private toTerraformExpression(): string {
    const args = this.args.map((arg) => expressionToString(arg)).join(", ");
    return `\${${this.name}(${args})}`;
  }
}

class PropertyAccessExpression implements IResolvable {
  constructor(
    private readonly target: Expression,
    private readonly path: readonly (string | number)[],
  ) {}

  resolve(_context: unknown): string {
    return this.toTerraformExpression();
  }

  toString(): string {
    return createToken(raw(this.toTerraformExpression()));
  }

  private toTerraformExpression(): string {
    const targetStr = expressionToString(this.target);
    const accessors = this.path
      .map((p) => {
        if (typeof p === "number") return `[${p}]`;
        if (/^[_a-zA-Z][_a-zA-Z0-9]*$/.test(p)) return `.${p}`;
        return `["${p}"]`;
      })
      .join("");
    return `\${${unwrapExpression(targetStr)}${accessors}}`;
  }
}

class ConditionalExpression implements IResolvable {
  constructor(
    private readonly condition: Expression,
    private readonly trueValue: Expression,
    private readonly falseValue: Expression,
  ) {}

  resolve(_context: unknown): string {
    return this.toTerraformExpression();
  }

  toString(): string {
    return createToken(raw(this.toTerraformExpression()));
  }

  private toTerraformExpression(): string {
    const cond = unwrapExpression(expressionToString(this.condition));
    const trueVal = unwrapExpression(expressionToString(this.trueValue));
    const falseVal = unwrapExpression(expressionToString(this.falseValue));
    return `\${${cond} ? ${trueVal} : ${falseVal}}`;
  }
}

class OperatorExpression implements IResolvable {
  constructor(
    private readonly operator: string,
    private readonly left: Expression,
    private readonly right?: Expression,
  ) {}

  resolve(_context: unknown): string {
    return this.toTerraformExpression();
  }

  toString(): string {
    return createToken(raw(this.toTerraformExpression()));
  }

  private toTerraformExpression(): string {
    const leftStr = unwrapExpression(expressionToString(this.left));

    if (this.right === undefined) {
      // Unary operator
      return `\${${this.operator}${leftStr}}`;
    }

    const rightStr = unwrapExpression(expressionToString(this.right));
    return `\${(${leftStr} ${this.operator} ${rightStr})}`;
  }
}

class RawStringExpression implements IResolvable {
  constructor(private readonly str: string) {}

  resolve(_context: unknown): string {
    return this.toTerraformExpression();
  }

  toString(): string {
    return createToken(raw(this.toTerraformExpression()));
  }

  private toTerraformExpression(): string {
    const escaped = this.str
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\${/g, "$${");
    return `"${escaped}"`;
  }
}

function expressionToString(expr: unknown): string {
  if (expr === null) return "null";
  if (expr === undefined) return "null";
  if (typeof expr === "boolean") return expr ? "true" : "false";
  if (typeof expr === "number") return String(expr);
  if (typeof expr === "string") {
    // Check if it's already a terraform expression
    if (expr.startsWith("${") && expr.endsWith("}")) {
      return expr;
    }
    // Check if it contains token markers
    if (expr.includes("${TfToken[")) {
      // Resolve the token to get the terraform expression
      return expr;
    }
    return `"${escapeString(expr)}"`;
  }
  if (Array.isArray(expr)) {
    return `[${expr.map(expressionToString).join(", ")}]`;
  }
  if (isResolvable(expr)) {
    return expr.toString();
  }
  if (typeof expr === "object") {
    const entries = Object.entries(expr);
    const parts = entries.map(([k, v]) => `${k} = ${expressionToString(v)}`);
    return `{${parts.join(", ")}}`;
  }
  return String(expr);
}

function escapeString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\${/g, "$${");
}

function unwrapExpression(expr: string): string {
  if (expr.startsWith("${") && expr.endsWith("}")) {
    return expr.slice(2, -1);
  }
  return expr;
}

function isResolvable(value: unknown): value is IResolvable {
  return (
    value !== null &&
    typeof value === "object" &&
    "resolve" in value &&
    typeof (value as IResolvable).resolve === "function"
  );
}

function terraformFunction(name: string, args: unknown[]): string {
  return new FunctionCallExpression(name, args).toString();
}

export class Fn {
  // Numeric Functions
  static abs(num: number | string): string {
    return terraformFunction("abs", [num]);
  }

  static ceil(num: number | string): string {
    return terraformFunction("ceil", [num]);
  }

  static floor(num: number | string): string {
    return terraformFunction("floor", [num]);
  }

  static log(num: number | string, base: number | string): string {
    return terraformFunction("log", [num, base]);
  }

  static max(numbers: (number | string)[]): string {
    return terraformFunction("max", numbers);
  }

  static min(numbers: (number | string)[]): string {
    return terraformFunction("min", numbers);
  }

  static parseint(str: string, base: number | string): string {
    return terraformFunction("parseint", [str, base]);
  }

  static pow(num: number | string, power: number | string): string {
    return terraformFunction("pow", [num, power]);
  }

  static signum(num: number | string): string {
    return terraformFunction("signum", [num]);
  }

  // String Functions
  static chomp(str: string): string {
    return terraformFunction("chomp", [str]);
  }

  static endswith(str: string, suffix: string): string {
    return terraformFunction("endswith", [str, suffix]);
  }

  static format(format: string, ...args: unknown[]): string {
    return terraformFunction("format", [format, ...args]);
  }

  static formatlist(format: string, ...args: unknown[]): string {
    return terraformFunction("formatlist", [format, ...args]);
  }

  static indent(spaces: number | string, str: string): string {
    return terraformFunction("indent", [spaces, str]);
  }

  static join(separator: string, list: unknown[]): string {
    return terraformFunction("join", [separator, list]);
  }

  static lower(str: string): string {
    return terraformFunction("lower", [str]);
  }

  static regex(pattern: string, str: string): string {
    return terraformFunction("regex", [pattern, str]);
  }

  static regexall(pattern: string, str: string): string {
    return terraformFunction("regexall", [pattern, str]);
  }

  static replace(str: string, substr: string, replace: string): string {
    return terraformFunction("replace", [str, substr, replace]);
  }

  static split(separator: string, str: string): string {
    return terraformFunction("split", [separator, str]);
  }

  static startswith(str: string, prefix: string): string {
    return terraformFunction("startswith", [str, prefix]);
  }

  static strrev(str: string): string {
    return terraformFunction("strrev", [str]);
  }

  static substr(str: string, offset: number | string, length: number | string): string {
    return terraformFunction("substr", [str, offset, length]);
  }

  static title(str: string): string {
    return terraformFunction("title", [str]);
  }

  static trim(str: string, chars: string): string {
    return terraformFunction("trim", [str, chars]);
  }

  static trimprefix(str: string, prefix: string): string {
    return terraformFunction("trimprefix", [str, prefix]);
  }

  static trimsuffix(str: string, suffix: string): string {
    return terraformFunction("trimsuffix", [str, suffix]);
  }

  static trimspace(str: string): string {
    return terraformFunction("trimspace", [str]);
  }

  static upper(str: string): string {
    return terraformFunction("upper", [str]);
  }

  // Collection Functions
  static alltrue(list: unknown[]): string {
    return terraformFunction("alltrue", [list]);
  }

  static anytrue(list: unknown[]): string {
    return terraformFunction("anytrue", [list]);
  }

  static chunklist(list: unknown[], size: number | string): string {
    return terraformFunction("chunklist", [list, size]);
  }

  static coalesce(...args: unknown[]): string {
    return terraformFunction("coalesce", args);
  }

  static coalescelist(...args: unknown[]): string {
    return terraformFunction("coalescelist", args);
  }

  static compact(list: unknown[]): string {
    return terraformFunction("compact", [list]);
  }

  static concat(...lists: unknown[][]): string {
    return terraformFunction("concat", lists);
  }

  static contains(list: unknown[], value: unknown): string {
    return terraformFunction("contains", [list, value]);
  }

  static distinct(list: unknown[]): string {
    return terraformFunction("distinct", [list]);
  }

  static element(list: unknown[], index: number | string): string {
    return terraformFunction("element", [list, index]);
  }

  static flatten(list: unknown[]): string {
    return terraformFunction("flatten", [list]);
  }

  static index(list: unknown[], value: unknown): string {
    return terraformFunction("index", [list, value]);
  }

  static keys(map: Record<string, unknown> | string): string {
    return terraformFunction("keys", [map]);
  }

  static length(value: unknown): string {
    return terraformFunction("length", [value]);
  }

  static lengthOf(value: unknown): string {
    return terraformFunction("length", [value]);
  }

  static list(...args: unknown[]): string {
    return terraformFunction("list", args);
  }

  static lookup(
    map: Record<string, unknown> | string,
    key: string,
    defaultValue?: unknown,
  ): string {
    if (defaultValue !== undefined) {
      return terraformFunction("lookup", [map, key, defaultValue]);
    }
    // Use property access when no default
    return new PropertyAccessExpression(map, [key]).toString();
  }

  static lookupNested(map: Record<string, unknown> | string, path: (string | number)[]): string {
    return new PropertyAccessExpression(map, path).toString();
  }

  static map(...args: unknown[]): string {
    return terraformFunction("map", args);
  }

  static matchkeys(values: unknown[], keys: unknown[], searchset: unknown[]): string {
    return terraformFunction("matchkeys", [values, keys, searchset]);
  }

  static merge(...maps: (Record<string, unknown> | string)[]): string {
    return terraformFunction("merge", maps);
  }

  static one(list: unknown[]): string {
    return terraformFunction("one", [list]);
  }

  static range(start: number | string, limit?: number | string, step?: number | string): string {
    const args: (number | string)[] = [start];
    if (limit !== undefined) args.push(limit);
    if (step !== undefined) args.push(step);
    return terraformFunction("range", args);
  }

  static reverse(list: unknown[]): string {
    return terraformFunction("reverse", [list]);
  }

  static setintersection(...sets: unknown[][]): string {
    return terraformFunction("setintersection", sets);
  }

  static setproduct(...sets: unknown[][]): string {
    return terraformFunction("setproduct", sets);
  }

  static setsubtract(a: unknown[], b: unknown[]): string {
    return terraformFunction("setsubtract", [a, b]);
  }

  static setunion(...sets: unknown[][]): string {
    return terraformFunction("setunion", sets);
  }

  static slice(list: unknown[], start: number | string, end: number | string): string {
    return terraformFunction("slice", [list, start, end]);
  }

  static sort(list: unknown[]): string {
    return terraformFunction("sort", [list]);
  }

  static sum(list: unknown[]): string {
    return terraformFunction("sum", [list]);
  }

  static transpose(map: Record<string, unknown> | string): string {
    return terraformFunction("transpose", [map]);
  }

  static values(map: Record<string, unknown> | string): string {
    return terraformFunction("values", [map]);
  }

  static zipmap(keys: unknown[], values: unknown[]): string {
    return terraformFunction("zipmap", [keys, values]);
  }

  // Encoding Functions
  static base64decode(str: string): string {
    return terraformFunction("base64decode", [str]);
  }

  static base64encode(str: string): string {
    return terraformFunction("base64encode", [str]);
  }

  static base64gzip(str: string): string {
    return terraformFunction("base64gzip", [str]);
  }

  static csvdecode(str: string): string {
    return terraformFunction("csvdecode", [str]);
  }

  static jsondecode(str: string): string {
    return terraformFunction("jsondecode", [str]);
  }

  static jsonencode(value: unknown): string {
    return terraformFunction("jsonencode", [value]);
  }

  static textdecodebase64(str: string, encoding: string): string {
    return terraformFunction("textdecodebase64", [str, encoding]);
  }

  static textencodebase64(str: string, encoding: string): string {
    return terraformFunction("textencodebase64", [str, encoding]);
  }

  static urlencode(str: string): string {
    return terraformFunction("urlencode", [str]);
  }

  static yamldecode(str: string): string {
    return terraformFunction("yamldecode", [str]);
  }

  static yamlencode(value: unknown): string {
    return terraformFunction("yamlencode", [value]);
  }

  // Filesystem Functions
  static abspath(path: string): string {
    return terraformFunction("abspath", [path]);
  }

  static dirname(path: string): string {
    return terraformFunction("dirname", [path]);
  }

  static pathexpand(path: string): string {
    return terraformFunction("pathexpand", [path]);
  }

  static basename(path: string): string {
    return terraformFunction("basename", [path]);
  }

  static file(path: string): string {
    return terraformFunction("file", [path]);
  }

  static fileexists(path: string): string {
    return terraformFunction("fileexists", [path]);
  }

  static fileset(path: string, pattern: string): string {
    return terraformFunction("fileset", [path, pattern]);
  }

  static filebase64(path: string): string {
    return terraformFunction("filebase64", [path]);
  }

  static templatefile(path: string, vars: Record<string, unknown> | string): string {
    return terraformFunction("templatefile", [path, vars]);
  }

  // Date and Time Functions
  static formatdate(format: string, timestamp: string): string {
    return terraformFunction("formatdate", [format, timestamp]);
  }

  static plantimestamp(): string {
    return terraformFunction("plantimestamp", []);
  }

  static timeadd(timestamp: string, duration: string): string {
    return terraformFunction("timeadd", [timestamp, duration]);
  }

  static timecmp(timestampA: string, timestampB: string): string {
    return terraformFunction("timecmp", [timestampA, timestampB]);
  }

  static timestamp(): string {
    return terraformFunction("timestamp", []);
  }

  // Hash and Crypto Functions
  static base64sha256(str: string): string {
    return terraformFunction("base64sha256", [str]);
  }

  static base64sha512(str: string): string {
    return terraformFunction("base64sha512", [str]);
  }

  static bcrypt(str: string, cost?: number | string): string {
    if (cost !== undefined) {
      return terraformFunction("bcrypt", [str, cost]);
    }
    return terraformFunction("bcrypt", [str]);
  }

  static filebase64sha256(path: string): string {
    return terraformFunction("filebase64sha256", [path]);
  }

  static filebase64sha512(path: string): string {
    return terraformFunction("filebase64sha512", [path]);
  }

  static filemd5(path: string): string {
    return terraformFunction("filemd5", [path]);
  }

  static filesha1(path: string): string {
    return terraformFunction("filesha1", [path]);
  }

  static filesha256(path: string): string {
    return terraformFunction("filesha256", [path]);
  }

  static filesha512(path: string): string {
    return terraformFunction("filesha512", [path]);
  }

  static md5(str: string): string {
    return terraformFunction("md5", [str]);
  }

  static rsadecrypt(ciphertext: string, privatekey: string): string {
    return terraformFunction("rsadecrypt", [ciphertext, privatekey]);
  }

  static sha1(str: string): string {
    return terraformFunction("sha1", [str]);
  }

  static sha256(str: string): string {
    return terraformFunction("sha256", [str]);
  }

  static sha512(str: string): string {
    return terraformFunction("sha512", [str]);
  }

  static uuid(): string {
    return terraformFunction("uuid", []);
  }

  static uuidv5(namespace: string, name: string): string {
    return terraformFunction("uuidv5", [namespace, name]);
  }

  // IP Network Functions
  static cidrhost(prefix: string, hostnum: number | string): string {
    return terraformFunction("cidrhost", [prefix, hostnum]);
  }

  static cidrnetmask(prefix: string): string {
    return terraformFunction("cidrnetmask", [prefix]);
  }

  static cidrsubnet(prefix: string, newbits: number | string, netnum: number | string): string {
    return terraformFunction("cidrsubnet", [prefix, newbits, netnum]);
  }

  static cidrsubnets(prefix: string, ...newbits: (number | string)[]): string {
    return terraformFunction("cidrsubnets", [prefix, ...newbits]);
  }

  // Type Conversion Functions
  static can(expression: unknown): string {
    return terraformFunction("can", [expression]);
  }

  static nonsensitive(value: unknown): string {
    return terraformFunction("nonsensitive", [value]);
  }

  static sensitive(value: unknown): string {
    return terraformFunction("sensitive", [value]);
  }

  static tobool(value: unknown): string {
    return terraformFunction("tobool", [value]);
  }

  static tolist(value: unknown): string {
    return terraformFunction("tolist", [value]);
  }

  static tomap(value: unknown): string {
    return terraformFunction("tomap", [value]);
  }

  static tonumber(value: unknown): string {
    return terraformFunction("tonumber", [value]);
  }

  static toset(value: unknown): string {
    return terraformFunction("toset", [value]);
  }

  static tostring(value: unknown): string {
    return terraformFunction("tostring", [value]);
  }

  static try(...expressions: unknown[]): string {
    return terraformFunction("try", expressions);
  }

  static type(value: unknown): string {
    return terraformFunction("type", [value]);
  }

  // Conditional expression helper
  static conditional(condition: Expression, trueValue: Expression, falseValue: Expression): string {
    return new ConditionalExpression(condition, trueValue, falseValue).toString();
  }

  // Raw string helper (escape properly for Terraform)
  static rawString(str: string): string {
    return new RawStringExpression(str).toString();
  }

  // Property access helper
  static propertyAccess(target: Expression, path: (string | number)[]): string {
    return new PropertyAccessExpression(target, path).toString();
  }
}

export class Op {
  static not(expression: Expression): string {
    return new OperatorExpression("!", expression).toString();
  }

  static negate(expression: Expression): string {
    return new OperatorExpression("-", expression).toString();
  }

  static mul(left: Expression, right: Expression): string {
    return new OperatorExpression("*", left, right).toString();
  }

  static div(left: Expression, right: Expression): string {
    return new OperatorExpression("/", left, right).toString();
  }

  static mod(left: Expression, right: Expression): string {
    return new OperatorExpression("%", left, right).toString();
  }

  static add(left: Expression, right: Expression): string {
    return new OperatorExpression("+", left, right).toString();
  }

  static sub(left: Expression, right: Expression): string {
    return new OperatorExpression("-", left, right).toString();
  }

  static gt(left: Expression, right: Expression): string {
    return new OperatorExpression(">", left, right).toString();
  }

  static gte(left: Expression, right: Expression): string {
    return new OperatorExpression(">=", left, right).toString();
  }

  static lt(left: Expression, right: Expression): string {
    return new OperatorExpression("<", left, right).toString();
  }

  static lte(left: Expression, right: Expression): string {
    return new OperatorExpression("<=", left, right).toString();
  }

  static eq(left: Expression, right: Expression): string {
    return new OperatorExpression("==", left, right).toString();
  }

  static neq(left: Expression, right: Expression): string {
    return new OperatorExpression("!=", left, right).toString();
  }

  static and(left: Expression, right: Expression): string {
    return new OperatorExpression("&&", left, right).toString();
  }

  static or(left: Expression, right: Expression): string {
    return new OperatorExpression("||", left, right).toString();
  }
}

export type { Expression, IResolvable };
