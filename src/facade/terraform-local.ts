import { createToken, ref } from "../core/tokens.js";
import type { Construct } from "./construct.js";
import { TerraformElement } from "./terraform-element.js";

const LOCAL_SYMBOL = Symbol.for("tfts/TerraformLocal");

export interface TerraformLocalConfig {
  readonly expression: unknown;
}

export class TerraformLocal extends TerraformElement {
  private readonly _expression: unknown;

  constructor(scope: Construct, id: string, expression: unknown) {
    super(scope, id);
    Object.defineProperty(this, LOCAL_SYMBOL, { value: true });
    this._expression = expression;
  }

  static isTerraformLocal(x: unknown): x is TerraformLocal {
    return x !== null && typeof x === "object" && LOCAL_SYMBOL in x;
  }

  get expression(): unknown {
    return this._expression;
  }

  get asString(): string {
    const token = ref(`local`, this.friendlyUniqueId);
    return createToken(token);
  }

  get asNumber(): number {
    return Number(this.asString);
  }

  get asBoolean(): boolean {
    return Boolean(this.asString);
  }

  get asList(): string[] {
    return [this.asString];
  }

  override toTerraform(): Record<string, unknown> {
    return {
      locals: {
        [this.friendlyUniqueId]: this._expression,
      },
    };
  }
}
