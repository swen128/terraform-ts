export class Tokenization {
  static isResolvable(x: unknown): boolean {
    if (x === null || x === undefined) {
      return false;
    }
    if (typeof x !== "object") {
      return false;
    }
    const maybeResolvable = x as { resolve?: unknown };
    return typeof maybeResolvable.resolve === "function";
  }
}
