const CONSTRUCT_SYMBOL = Symbol.for("tfts/Construct");

export interface IConstruct {
  readonly node: Node;
}

export class Node {
  private readonly _construct: Construct;
  private readonly _children: Map<string, Construct> = new Map();
  private readonly _metadata: Array<{ type: string; data: unknown }> = [];
  private readonly _validations: IValidation[] = [];
  private _context: Record<string, unknown> = {};

  constructor(construct: Construct) {
    this._construct = construct;
  }

  get id(): string {
    return this._construct._id;
  }

  get path(): string {
    return this._construct._path.join("/");
  }

  get scope(): Construct | undefined {
    return this._construct._scope;
  }

  get scopes(): Construct[] {
    const result: Construct[] = [];
    let current: Construct | undefined = this._construct;
    while (current) {
      result.unshift(current);
      current = current._scope;
    }
    return result;
  }

  get children(): Construct[] {
    return Array.from(this._children.values());
  }

  get metadata(): Array<{ type: string; data: unknown; trace?: string[] }> {
    return this._metadata.map((m) => ({ ...m }));
  }

  addChild(child: Construct): void {
    if (this._children.has(child._id)) {
      throw new Error(`There is already a construct with id '${child._id}' in ${this.path}`);
    }
    this._children.set(child._id, child);
  }

  tryFindChild(id: string): Construct | undefined {
    return this._children.get(id);
  }

  findChild(id: string): Construct {
    const child = this.tryFindChild(id);
    if (!child) {
      throw new Error(`No construct with id '${id}' found in ${this.path}`);
    }
    return child;
  }

  findAll(order: ConstructOrder = ConstructOrder.PREORDER): IConstruct[] {
    const result: IConstruct[] = [];
    const visit = (construct: Construct) => {
      if (order === ConstructOrder.PREORDER) {
        result.push(construct);
      }
      for (const child of construct.node.children) {
        visit(child);
      }
      if (order === ConstructOrder.POSTORDER) {
        result.push(construct);
      }
    };
    visit(this._construct);
    return result;
  }

  setContext(key: string, value: unknown): void {
    this._context[key] = value;
  }

  tryGetContext(key: string): unknown {
    if (key in this._context) {
      return this._context[key];
    }
    return this.scope?.node.tryGetContext(key);
  }

  getContext(key: string): unknown {
    const value = this.tryGetContext(key);
    if (value === undefined) {
      throw new Error(`Context key '${key}' not found`);
    }
    return value;
  }

  addMetadata(type: string, data: unknown): void {
    this._metadata.push({ type, data });
  }

  addValidation(validation: IValidation): void {
    this._validations.push(validation);
  }

  validate(): string[] {
    const errors: string[] = [];
    for (const validation of this._validations) {
      errors.push(...validation.validate());
    }
    return errors;
  }
}

export interface IValidation {
  validate(): string[];
}

export enum ConstructOrder {
  PREORDER = "preorder",
  POSTORDER = "postorder",
}

export class Construct implements IConstruct {
  readonly _id: string;
  readonly _path: readonly string[];
  readonly _scope: Construct | undefined;
  readonly node: Node;

  constructor(scope: Construct | undefined, id: string) {
    this._id = id;
    this._scope = scope;

    if (scope) {
      this._path = [...scope._path, id];
      scope.node.addChild(this);
    } else {
      this._path = id ? [id] : [];
    }

    this.node = new Node(this);
    Object.defineProperty(this, CONSTRUCT_SYMBOL, { value: true });
  }

  static isConstruct(x: unknown): x is Construct {
    return x !== null && typeof x === "object" && CONSTRUCT_SYMBOL in x;
  }

  toString(): string {
    return this.node.path;
  }
}

export function dependable(construct: IConstruct | string): string {
  if (typeof construct === "string") {
    return construct;
  }
  if ("fqn" in construct && typeof construct.fqn === "string") {
    return construct.fqn;
  }
  return construct.node.path;
}
