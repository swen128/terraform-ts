import { createToken, ref } from "../core/tokens.js";
import { Construct } from "./construct.js";
import type { TerraformStack } from "./terraform-stack.js";

const ELEMENT_SYMBOL = Symbol.for("tfts/TerraformElement");

function getStack(element: Construct): TerraformStack {
  const { TerraformStack: StackClass } = require("./terraform-stack.js");
  return StackClass.of(element);
}

export type TerraformElementMetadata = {
  readonly path: string;
  readonly uniqueId: string;
  readonly stackTrace?: string[];
}

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

  static isTerraformElement(x: unknown): x is TerraformElement {
    return x !== null && typeof x === "object" && ELEMENT_SYMBOL in x;
  }

  get cdktfStack(): TerraformStack {
    return getStack(this);
  }

  get fqn(): string {
    if (!this._fqnToken) {
      if (!this._elementType) {
        throw new Error("Element type not set");
      }
      const token = ref(`${this._elementType}.${this.friendlyUniqueId}`, "");
      this._fqnToken = createToken(token);
    }
    return this._fqnToken;
  }

  get friendlyUniqueId(): string {
    if (!this._friendlyUniqueId) {
      if (this._logicalIdOverride) {
        this._friendlyUniqueId = this._logicalIdOverride;
      } else {
        this._friendlyUniqueId = this.cdktfStack.getLogicalId(this);
      }
    }
    return this._friendlyUniqueId;
  }

  overrideLogicalId(newLogicalId: string): void {
    if (this._fqnToken) {
      throw new Error("Logical ID cannot be overridden after .fqn has been accessed");
    }
    this._logicalIdOverride = newLogicalId;
  }

  resetOverrideLogicalId(): void {
    if (this._fqnToken) {
      throw new Error("Logical ID cannot be reset after .fqn has been accessed");
    }
    this._logicalIdOverride = undefined;
  }

  addOverride(path: string, value: unknown): void {
    const parts = path.split(".");
    let curr: Record<string, unknown> = this.rawOverrides;

    while (parts.length > 1) {
      const key = parts.shift()!;
      if (!(key in curr) || typeof curr[key] !== "object" || curr[key] === null) {
        curr[key] = {};
      }
      curr = curr[key] as Record<string, unknown>;
    }

    const lastKey = parts.shift()!;
    curr[lastKey] = value;
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
