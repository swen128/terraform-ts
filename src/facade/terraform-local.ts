import { createToken, ref } from "../core/tokens.js";
import type { Construct } from "./construct.js";
import type { ElementKind } from "./terraform-element.js";
import { TerraformElement } from "./terraform-element.js";

export type TerraformLocalConfig = {
  readonly expression: unknown;
};

export class TerraformLocal extends TerraformElement {
  readonly kind: ElementKind = "local";

  private readonly _expression: unknown;

  constructor(scope: Construct, id: string, expression: unknown) {
    super(scope, id);
    this._expression = expression;
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
