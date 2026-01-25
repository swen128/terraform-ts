import { createToken, fn, type IResolvable, type IResolveContext, raw } from "../core/tokens.js";
import type { IInterpolatingParent } from "./terraform-addressable.js";

function propertyAccess(expression: unknown, path: (string | number | undefined)[]): IResolvable {
  const pathStr = path
    .filter((p) => p !== undefined)
    .map((p) => (typeof p === "number" ? `[${p}]` : `["${p}"]`))
    .join("");
  return {
    creationStack: [],
    resolve(_context: IResolveContext): unknown {
      if (typeof expression === "string") {
        return `${expression}${pathStr}`;
      }
      const resolved =
        typeof (expression as IResolvable).resolve === "function"
          ? (expression as IResolvable).resolve(_context)
          : expression;
      return `${resolved}${pathStr}`;
    },
    toString(): string {
      return createToken(raw(`${expression}${pathStr}`));
    },
  };
}

class Token {
  static asString(value: IResolvable | string): string {
    if (typeof value === "string") return value;
    return createToken(
      raw(
        String(
          value.resolve({
            scope: undefined,
            preparing: false,
            originStack: [],
            registerPostProcessor: () => {},
            resolve: (v) => v,
          }),
        ),
      ),
    );
  }

  static asNumber(value: IResolvable): number {
    return Number(Token.asString(value));
  }

  static asList(value: IResolvable): string[] {
    return [Token.asString(value)];
  }

  static asNumberList(value: IResolvable): number[] {
    return [Token.asNumber(value)];
  }

  static asStringMap(value: IResolvable): Record<string, string> {
    return { "": Token.asString(value) };
  }

  static asNumberMap(value: IResolvable): Record<string, number> {
    return { "": Token.asNumber(value) };
  }

  static asBooleanMap(value: IResolvable): Record<string, IResolvable> {
    return { "": value };
  }

  static asAnyMap(value: IResolvable): Record<string, unknown> {
    return { "": value };
  }

  static asAny(value: IResolvable): unknown {
    return value;
  }
}

class Fn {
  static tolist(value: IResolvable): IResolvable {
    const resolved = value.resolve({
      scope: undefined,
      preparing: false,
      originStack: [],
      registerPostProcessor: () => {},
      resolve: (v) => v,
    });
    return {
      creationStack: [],
      resolve(_context: IResolveContext): unknown {
        return createToken(fn("tolist", resolved));
      },
      toString(): string {
        return createToken(fn("tolist", resolved));
      },
    };
  }

  static element(list: IResolvable, index: number): IResolvable {
    return {
      creationStack: [],
      resolve(_context: IResolveContext): unknown {
        const resolved = list.resolve(_context);
        return createToken(fn("element", resolved, index));
      },
      toString(): string {
        return createToken(fn("element", list, index));
      },
    };
  }
}

abstract class ComplexResolvable implements IResolvable {
  public readonly creationStack: string[] = [];
  protected _fqn?: string;
  protected terraformResource: IInterpolatingParent;
  protected terraformAttribute: string;

  constructor(terraformResource: IInterpolatingParent, terraformAttribute: string) {
    this.terraformResource = terraformResource;
    this.terraformAttribute = terraformAttribute;
  }

  abstract computeFqn(): string;

  get fqn(): string {
    if (this._fqn === undefined) {
      this._fqn = this.computeFqn();
    }
    return this._fqn;
  }

  resolve(_context: IResolveContext): unknown {
    return this.fqn;
  }

  toString(): string {
    return Token.asString(this);
  }
}

abstract class ComplexComputedAttribute extends ComplexResolvable implements IInterpolatingParent {
  constructor(terraformResource: IInterpolatingParent, terraformAttribute: string) {
    super(terraformResource, terraformAttribute);
  }

  public getStringAttribute(attr: string): string {
    return Token.asString(this.interpolationForAttribute(attr));
  }

  public getNumberAttribute(attr: string): number {
    return Token.asNumber(this.interpolationForAttribute(attr));
  }

  public getListAttribute(attr: string): string[] {
    return Token.asList(this.interpolationForAttribute(attr));
  }

  public getBooleanAttribute(attr: string): IResolvable {
    return this.interpolationForAttribute(attr);
  }

  public getNumberListAttribute(attr: string): number[] {
    return Token.asNumberList(this.interpolationForAttribute(attr));
  }

  public getStringMapAttribute(attr: string): Record<string, string> {
    return Token.asStringMap(this.interpolationForAttribute(attr));
  }

  public getNumberMapAttribute(attr: string): Record<string, number> {
    return Token.asNumberMap(this.interpolationForAttribute(attr));
  }

  public getBooleanMapAttribute(attr: string): Record<string, IResolvable> {
    return Token.asBooleanMap(this.interpolationForAttribute(attr));
  }

  public getAnyMapAttribute(attr: string): Record<string, unknown> {
    return Token.asAnyMap(this.interpolationForAttribute(attr));
  }

  public abstract interpolationForAttribute(attr: string): IResolvable;
}

export class StringMap extends ComplexResolvable {
  public lookup(key: string): string {
    return Token.asString(
      this.terraformResource.interpolationForAttribute(`${this.terraformAttribute}["${key}"]`),
    );
  }

  computeFqn(): string {
    return Token.asString(
      this.terraformResource.interpolationForAttribute(this.terraformAttribute),
    );
  }
}

export class NumberMap extends ComplexResolvable {
  public lookup(key: string): number {
    return Token.asNumber(
      this.terraformResource.interpolationForAttribute(`${this.terraformAttribute}["${key}"]`),
    );
  }

  computeFqn(): string {
    return Token.asString(
      this.terraformResource.interpolationForAttribute(this.terraformAttribute),
    );
  }
}

export class BooleanMap extends ComplexResolvable {
  public lookup(key: string): IResolvable {
    return this.terraformResource.interpolationForAttribute(`${this.terraformAttribute}["${key}"]`);
  }

  computeFqn(): string {
    return Token.asString(
      this.terraformResource.interpolationForAttribute(this.terraformAttribute),
    );
  }
}

export class AnyMap extends ComplexResolvable {
  public lookup(key: string): unknown {
    return Token.asAny(
      this.terraformResource.interpolationForAttribute(`${this.terraformAttribute}["${key}"]`),
    );
  }

  computeFqn(): string {
    return Token.asString(
      this.terraformResource.interpolationForAttribute(this.terraformAttribute),
    );
  }
}

export abstract class ComplexList extends ComplexResolvable {
  protected wrapsSet: boolean;

  constructor(
    terraformResource: IInterpolatingParent,
    terraformAttribute: string,
    wrapsSet: boolean,
  ) {
    super(terraformResource, terraformAttribute);
    this.wrapsSet = wrapsSet;
  }

  computeFqn(): string {
    if (this.wrapsSet) {
      return Token.asString(
        Fn.tolist(this.terraformResource.interpolationForAttribute(this.terraformAttribute)),
      );
    }
    return Token.asString(
      this.terraformResource.interpolationForAttribute(this.terraformAttribute),
    );
  }

  public allWithMapKey(_mapKeyAttributeName: string): unknown {
    return Token.asAny(this as IResolvable);
  }
}

export class BooleanList extends ComplexList {
  public get(index: number): IResolvable {
    return Fn.element(this, index);
  }
}

export class StringListList extends ComplexList {
  public get(index: number): string[] {
    return Token.asList(
      this.terraformResource.interpolationForAttribute(`${this.terraformAttribute}[${index}]`),
    );
  }
}

export class NumberListList extends ComplexList {
  public get(index: number): number[] {
    return Token.asNumberList(
      this.terraformResource.interpolationForAttribute(`${this.terraformAttribute}[${index}]`),
    );
  }
}

export class BooleanListList extends ComplexList {
  public get(index: number): IResolvable {
    return this.terraformResource.interpolationForAttribute(`${this.terraformAttribute}[${index}]`);
  }
}

export class AnyListList extends ComplexList {
  public get(index: number): IResolvable {
    return this.terraformResource.interpolationForAttribute(`${this.terraformAttribute}[${index}]`);
  }
}

export abstract class ComplexMap extends ComplexResolvable {
  computeFqn(): string {
    return Token.asString(
      this.terraformResource.interpolationForAttribute(this.terraformAttribute),
    );
  }

  interpolationForAttribute(property: string): IResolvable {
    return propertyAccess(
      this.terraformResource.interpolationForAttribute(this.terraformAttribute),
      [property],
    );
  }
}

export class ComplexObject extends ComplexComputedAttribute {
  protected complexObjectIsFromSet: boolean;
  protected complexObjectIndex?: number | string;
  private _internalValue: unknown;

  constructor(
    terraformResource: IInterpolatingParent,
    terraformAttribute: string,
    complexObjectIsFromSet: boolean,
    complexObjectIndex?: number | string,
  ) {
    super(terraformResource, terraformAttribute);
    this.complexObjectIsFromSet = complexObjectIsFromSet;
    this.complexObjectIndex = complexObjectIndex;
  }

  public interpolationForAttribute(property: string): IResolvable {
    if (this.complexObjectIsFromSet) {
      return propertyAccess(
        Fn.tolist(this.terraformResource.interpolationForAttribute(this.terraformAttribute)),
        [this.complexObjectIndex, property],
      );
    }

    const path =
      this.complexObjectIndex !== undefined
        ? `${this.terraformAttribute}[${this.complexObjectIndex}].${property}`
        : `${this.terraformAttribute}.${property}`;
    return this.terraformResource.interpolationForAttribute(path);
  }

  protected interpolationAsList(): IResolvable {
    return this.terraformResource.interpolationForAttribute(`${this.terraformAttribute}.*`);
  }

  computeFqn(): string {
    if (this.complexObjectIsFromSet) {
      return Token.asString(
        propertyAccess(
          Fn.tolist(this.terraformResource.interpolationForAttribute(this.terraformAttribute)),
          [this.complexObjectIndex],
        ),
      );
    }

    const path =
      this.complexObjectIndex !== undefined
        ? `${this.terraformAttribute}[${this.complexObjectIndex}]`
        : this.terraformAttribute;
    return Token.asString(this.terraformResource.interpolationForAttribute(path));
  }

  get internalValue(): unknown {
    return this._internalValue;
  }

  set internalValue(value: unknown) {
    this._internalValue = value;
  }
}

export abstract class MapList extends ComplexResolvable implements IInterpolatingParent {
  protected wrapsSet: boolean;

  constructor(
    terraformResource: IInterpolatingParent,
    terraformAttribute: string,
    wrapsSet: boolean,
  ) {
    super(terraformResource, terraformAttribute);
    this.wrapsSet = wrapsSet;
  }

  computeFqn(): string {
    if (this.wrapsSet) {
      return Token.asString(
        Fn.tolist(this.terraformResource.interpolationForAttribute(this.terraformAttribute)),
      );
    }
    return Token.asString(
      this.terraformResource.interpolationForAttribute(this.terraformAttribute),
    );
  }

  interpolationForAttribute(property: string): IResolvable {
    if (this.wrapsSet) {
      const matches = property.match(/\[([^\]]*)\]/);
      if (matches !== null && matches[1] !== undefined) {
        return propertyAccess(
          Fn.tolist(this.terraformResource.interpolationForAttribute(this.terraformAttribute)),
          [matches[1], property],
        );
      }
    }
    return this.terraformResource.interpolationForAttribute(
      `${this.terraformAttribute}${property}`,
    );
  }
}

export class StringMapList extends MapList {
  public get(index: number): StringMap {
    return new StringMap(this, `[${index}]`);
  }
}

export class NumberMapList extends MapList {
  public get(index: number): NumberMap {
    return new NumberMap(this, `[${index}]`);
  }
}

export class BooleanMapList extends MapList {
  public get(index: number): BooleanMap {
    return new BooleanMap(this, `[${index}]`);
  }
}

export class AnyMapList extends MapList {
  public get(index: number): AnyMap {
    return new AnyMap(this, `[${index}]`);
  }
}

export class StringListMap extends ComplexMap {
  public get(key: string): string[] {
    return Token.asList(
      this.terraformResource.interpolationForAttribute(`${this.terraformAttribute}[${key}]`),
    );
  }
}

export class NumberListMap extends ComplexMap {
  public get(key: string): number[] {
    return Token.asNumberList(
      this.terraformResource.interpolationForAttribute(`${this.terraformAttribute}[${key}]`),
    );
  }
}

export class BooleanListMap extends ComplexMap {
  public get(key: string): IResolvable {
    return this.terraformResource.interpolationForAttribute(`${this.terraformAttribute}[${key}]`);
  }
}

export class AnyListMap extends ComplexMap {
  public get(key: string): IResolvable {
    return this.terraformResource.interpolationForAttribute(`${this.terraformAttribute}[${key}]`);
  }
}

export class ComplexComputedList extends ComplexComputedAttribute {
  protected complexComputedListIndex: string;
  protected wrapsSet?: boolean;

  constructor(
    terraformResource: IInterpolatingParent,
    terraformAttribute: string,
    complexComputedListIndex: string,
    wrapsSet?: boolean,
  ) {
    super(terraformResource, terraformAttribute);
    this.complexComputedListIndex = complexComputedListIndex;
    this.wrapsSet = wrapsSet;
  }

  public interpolationForAttribute(property: string): IResolvable {
    if (this.wrapsSet === true) {
      return propertyAccess(
        Fn.tolist(this.terraformResource.interpolationForAttribute(this.terraformAttribute)),
        [this.complexComputedListIndex, property],
      );
    }
    return this.terraformResource.interpolationForAttribute(
      `${this.terraformAttribute}[${this.complexComputedListIndex}].${property}`,
    );
  }

  computeFqn(): string {
    if (this.wrapsSet === true) {
      return Token.asString(
        propertyAccess(
          Fn.tolist(this.terraformResource.interpolationForAttribute(this.terraformAttribute)),
          [this.complexComputedListIndex],
        ),
      );
    }
    return Token.asString(
      this.terraformResource.interpolationForAttribute(
        `${this.terraformAttribute}[${this.complexComputedListIndex}]`,
      ),
    );
  }
}
