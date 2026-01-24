import { createToken, ref } from "../core/tokens.js";
import { Construct } from "./construct.js";

const ELEMENT_SYMBOL = Symbol.for("tfts/TerraformElement");

type TerraformStackLike = {
  getLogicalId(element: TerraformElement): string;
};

let cachedStackClass: { of: (element: Construct) => TerraformStackLike } | null = null;

function getStack(element: Construct): TerraformStackLike {
  if (cachedStackClass === null) {
    const mod = require("./terraform-stack.js") as {
      TerraformStack: { of: (element: Construct) => TerraformStackLike };
    };
    cachedStackClass = mod.TerraformStack;
  }
  return cachedStackClass.of(element);
}

export type TerraformElementMetadata = {
  readonly path: string;
  readonly uniqueId: string;
  readonly stackTrace?: string[];
};

export class TerraformElement extends Construct {
  protected readonly rawOverrides: Record<string, unknown> = {};
  private _logicalIdOverride?: string;
  private readonly _elementType?: string;
  private _fqnToken?: string;
  private _friendlyUniqueId?: string;

  constructor(scope: Construct, id: string, elementType?: string) {
    super(scope, id);
    Object.defineProperty(this, ELEMENT_SYMBOL, { value: true });
    this._elementType = elementType;
  }

  static asTerraformElement(x: unknown): TerraformElement | null {
    if (x === null || typeof x !== "object") return null;
    if (Object.prototype.hasOwnProperty.call(x, ELEMENT_SYMBOL)) {
      return x as TerraformElement;
    }
    return null;
  }

  get cdktfStack(): TerraformStackLike {
    return getStack(this);
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

  get friendlyUniqueId(): string {
    if (this._friendlyUniqueId === undefined) {
      if (this._logicalIdOverride !== undefined && this._logicalIdOverride !== "") {
        this._friendlyUniqueId = this._logicalIdOverride;
      } else {
        this._friendlyUniqueId = this.cdktfStack.getLogicalId(this);
      }
    }
    return this._friendlyUniqueId;
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
    const parts = path.split(".");
    let curr: Record<string, unknown> = this.rawOverrides;

    while (parts.length > 1) {
      const key = parts[0];
      parts.shift();
      if (key === undefined) break;
      const existing = curr[key];
      if (existing === undefined || typeof existing !== "object" || existing === null) {
        curr[key] = {};
      }
      const next = curr[key];
      if (typeof next === "object" && next !== null) {
        curr = next as Record<string, unknown>;
      }
    }

    const lastKey = parts[0];
    if (lastKey !== undefined) {
      curr[lastKey] = value;
    }
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
