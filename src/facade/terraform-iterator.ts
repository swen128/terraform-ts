import { createToken, fn as fnToken, lazy } from "../core/tokens.js";

const ITERATOR_SYMBOL = Symbol.for("tfts/TerraformIterator");

export type ITerraformIterator = {
  _getForEachExpression(): unknown;
}

export abstract class TerraformIterator implements ITerraformIterator {
  constructor() {
    Object.defineProperty(this, ITERATOR_SYMBOL, { value: true });
  }

  static isIterator(x: unknown): x is TerraformIterator {
    return x !== null && typeof x === "object" && ITERATOR_SYMBOL in x;
  }

  abstract _getForEachExpression(): unknown;

  static fromList(list: unknown[]): ListTerraformIterator {
    return new ListTerraformIterator(list);
  }

  static fromMap(map: Record<string, unknown>): MapTerraformIterator {
    return new MapTerraformIterator(map);
  }

  getString(attribute: string): string {
    return createToken(lazy(() => `each.value.${attribute}`));
  }

  getNumber(attribute: string): number {
    return Number(this.getString(attribute));
  }

  getBoolean(attribute: string): boolean {
    return Boolean(this.getString(attribute));
  }

  getList(attribute: string): string[] {
    return [this.getString(attribute)];
  }

  get key(): string {
    return createToken(lazy(() => "each.key"));
  }

  get value(): string {
    return createToken(lazy(() => "each.value"));
  }

  keys(): string {
    const expr = this._getForEachExpression();
    return createToken(fnToken("keys", [expr]));
  }

  values(): string {
    const expr = this._getForEachExpression();
    return createToken(fnToken("values", [expr]));
  }

  dynamic(attributes: Record<string, unknown>): DynamicBlock {
    return {
      iterator: this,
      content: attributes,
    };
  }
}

export type DynamicBlock = {
  iterator: ITerraformIterator;
  content: Record<string, unknown>;
}

export class ListTerraformIterator extends TerraformIterator {
  constructor(private readonly list: unknown[]) {
    super();
  }

  override _getForEachExpression(): unknown {
    return { "toset()": this.list };
  }
}

export class MapTerraformIterator extends TerraformIterator {
  constructor(private readonly map: Record<string, unknown>) {
    super();
  }

  override _getForEachExpression(): unknown {
    return this.map;
  }
}

export class TerraformCount {
  private readonly _count: number | string;

  private constructor(count: number | string) {
    this._count = count;
  }

  static of(count: number | string): TerraformCount {
    return new TerraformCount(count);
  }

  get index(): string {
    return createToken(lazy(() => "count.index"));
  }

  toNumber(): number | string {
    return this._count;
  }
}
