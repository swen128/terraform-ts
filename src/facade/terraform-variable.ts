import { createToken, ref } from "../core/tokens.js";
import type { Construct } from "./construct.js";
import type { ElementKind } from "./terraform-element.js";
import { TerraformElement } from "./terraform-element.js";

export type TerraformVariableValidation = {
  readonly condition: string;
  readonly errorMessage: string;
};

export type TerraformVariableConfig = {
  readonly type?: string;
  readonly default?: unknown;
  readonly description?: string;
  readonly sensitive?: boolean;
  readonly nullable?: boolean;
  readonly validation?: TerraformVariableValidation[];
};

export class TerraformVariable extends TerraformElement {
  readonly kind: ElementKind = "variable";

  private readonly _type?: string;
  private readonly _default?: unknown;
  private readonly _description?: string;
  private readonly _sensitive?: boolean;
  private readonly _nullable?: boolean;
  private readonly _validation?: TerraformVariableValidation[];

  constructor(scope: Construct, id: string, config: TerraformVariableConfig = {}) {
    super(scope, id);

    this._type = config.type;
    this._default = config.default;
    this._description = config.description;
    this._sensitive = config.sensitive;
    this._nullable = config.nullable;
    this._validation = config.validation;
  }

  get value(): unknown {
    const token = ref(`var`, this.friendlyUniqueId);
    return createToken(token);
  }

  get stringValue(): string {
    return String(this.value);
  }

  get numberValue(): number {
    return Number(this.value);
  }

  get booleanValue(): boolean {
    return Boolean(this.value);
  }

  get listValue(): string[] {
    return [String(this.value)];
  }

  override toTerraform(): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (this._type !== undefined && this._type !== "") {
      result["type"] = this._type;
    }
    if (this._default !== undefined) {
      result["default"] = this._default;
    }
    if (this._description !== undefined && this._description !== "") {
      result["description"] = this._description;
    }
    if (this._sensitive !== undefined) {
      result["sensitive"] = this._sensitive;
    }
    if (this._nullable !== undefined) {
      result["nullable"] = this._nullable;
    }
    if (this._validation !== undefined && this._validation.length > 0) {
      result["validation"] = this._validation.map((v) => ({
        condition: v.condition,
        error_message: v.errorMessage,
      }));
    }

    return {
      variable: {
        [this.friendlyUniqueId]: result,
      },
    };
  }
}
