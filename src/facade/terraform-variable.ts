import { createToken, ref } from "../core/tokens.js";
import type { Construct } from "./construct.js";
import { TerraformElement } from "./terraform-element.js";

const VARIABLE_SYMBOL = Symbol.for("tfts/TerraformVariable");

export interface TerraformVariableValidation {
  readonly condition: string;
  readonly errorMessage: string;
}

export interface TerraformVariableConfig {
  readonly type?: string;
  readonly default?: unknown;
  readonly description?: string;
  readonly sensitive?: boolean;
  readonly nullable?: boolean;
  readonly validation?: TerraformVariableValidation[];
}

export class TerraformVariable extends TerraformElement {
  private readonly _type?: string;
  private readonly _default?: unknown;
  private readonly _description?: string;
  private readonly _sensitive?: boolean;
  private readonly _nullable?: boolean;
  private readonly _validation?: TerraformVariableValidation[];

  constructor(scope: Construct, id: string, config: TerraformVariableConfig = {}) {
    super(scope, id);
    Object.defineProperty(this, VARIABLE_SYMBOL, { value: true });

    this._type = config.type;
    this._default = config.default;
    this._description = config.description;
    this._sensitive = config.sensitive;
    this._nullable = config.nullable;
    this._validation = config.validation;
  }

  static isTerraformVariable(x: unknown): x is TerraformVariable {
    return x !== null && typeof x === "object" && VARIABLE_SYMBOL in x;
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
    const validations = this._validation?.map((v) => ({
      condition: v.condition,
      error_message: v.errorMessage,
    }));

    return {
      variable: {
        [this.friendlyUniqueId]: {
          ...(this._type ? { type: this._type } : {}),
          ...(this._default !== undefined ? { default: this._default } : {}),
          ...(this._description ? { description: this._description } : {}),
          ...(this._sensitive !== undefined ? { sensitive: this._sensitive } : {}),
          ...(this._nullable !== undefined ? { nullable: this._nullable } : {}),
          ...(validations?.length ? { validation: validations } : {}),
        },
      },
    };
  }
}
