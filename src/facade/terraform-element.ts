import { generateLogicalId } from "../core/synthesize.js";
import { createToken, ref } from "../core/tokens.js";
import { Construct } from "./construct.js";

export type ElementKind =
  | "stack"
  | "resource"
  | "data-source"
  | "provider"
  | "backend"
  | "output"
  | "variable"
  | "local"
  | "module"
  | "remote-state"
  | "import";

export type TerraformElementMetadata = {
  readonly path: string;
  readonly uniqueId: string;
  readonly stackTrace?: string[];
};

function buildNestedObject(overrides: Map<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const nodes = new Map<string, Record<string, unknown>>([["", result]]);

  for (const [path, value] of overrides) {
    const parts = path.split(".");
    let currentPath = "";
    let current = result;

    for (const key of parts.slice(0, -1)) {
      const nextPath = currentPath === "" ? key : `${currentPath}.${key}`;
      let next = nodes.get(nextPath);
      if (next === undefined) {
        next = {};
        nodes.set(nextPath, next);
        current[key] = next;
      }
      current = next;
      currentPath = nextPath;
    }

    const lastKey = parts[parts.length - 1];
    if (lastKey !== undefined) {
      current[lastKey] = value;
    }
  }

  return result;
}

export abstract class TerraformElement extends Construct {
  abstract readonly kind: ElementKind;

  private readonly _overrides: Map<string, unknown> = new Map();
  private _logicalIdOverride?: string;
  private readonly _elementType?: string;
  private _fqnToken?: string;
  private _friendlyUniqueId?: string;

  constructor(scope: Construct, id: string, elementType?: string) {
    super(scope, id);
    this._elementType = elementType;
  }

  get fqn(): string {
    if (this._fqnToken === undefined) {
      if (this._elementType === undefined || this._elementType === "") {
        throw new Error("Element type not set");
      }
      const token = ref(`${this._elementType}.${this.friendlyUniqueId}`, "");
      this._fqnToken = createToken(token);
    }
    return this._fqnToken;
  }

  get rawFqn(): string {
    if (this._elementType === undefined || this._elementType === "") {
      throw new Error("Element type not set");
    }
    return `${this._elementType}.${this.friendlyUniqueId}`;
  }

  get friendlyUniqueId(): string {
    if (this._friendlyUniqueId === undefined) {
      if (this._logicalIdOverride !== undefined && this._logicalIdOverride !== "") {
        this._friendlyUniqueId = this._logicalIdOverride;
      } else {
        this._friendlyUniqueId = this.computeLogicalId();
      }
    }
    return this._friendlyUniqueId;
  }

  private computeLogicalId(): string {
    const pathParts = this.node.path.split("/");
    return generateLogicalId(pathParts);
  }

  overrideLogicalId(newLogicalId: string): void {
    if (this._fqnToken !== undefined) {
      throw new Error("Logical ID cannot be overridden after .fqn has been accessed");
    }
    this._logicalIdOverride = newLogicalId;
  }

  resetOverrideLogicalId(): void {
    if (this._fqnToken !== undefined) {
      throw new Error("Logical ID cannot be reset after .fqn has been accessed");
    }
    this._logicalIdOverride = undefined;
  }

  addOverride(path: string, value: unknown): void {
    this._overrides.set(path, value);
  }

  protected get rawOverrides(): Record<string, unknown> {
    return buildNestedObject(this._overrides);
  }

  toTerraform(): Record<string, unknown> {
    return {};
  }

  toMetadata(): Record<string, unknown> {
    return {};
  }

  protected get constructNodeMetadata(): TerraformElementMetadata {
    return {
      path: this.node.path,
      uniqueId: this.friendlyUniqueId,
    };
  }
}
