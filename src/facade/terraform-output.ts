import type { Construct } from "./construct.js";
import { TerraformElement } from "./terraform-element.js";

const OUTPUT_SYMBOL = Symbol.for("tfts/TerraformOutput");

export type TerraformOutputConfig = {
  readonly value: unknown;
  readonly description?: string;
  readonly sensitive?: boolean;
  readonly dependsOn?: string[];
}

export class TerraformOutput extends TerraformElement {
  private readonly _value: unknown;
  private readonly _description?: string;
  private readonly _sensitive?: boolean;
  private readonly _dependsOn?: string[];

  constructor(scope: Construct, id: string, config: TerraformOutputConfig) {
    super(scope, id);
    Object.defineProperty(this, OUTPUT_SYMBOL, { value: true });

    this._value = config.value;
    this._description = config.description;
    this._sensitive = config.sensitive;
    this._dependsOn = config.dependsOn;
  }

  static isTerraformOutput(x: unknown): x is TerraformOutput {
    return x !== null && typeof x === "object" && OUTPUT_SYMBOL in x;
  }

  get value(): unknown {
    return this._value;
  }

  override toTerraform(): Record<string, unknown> {
    return {
      output: {
        [this.friendlyUniqueId]: {
          value: this._value,
          ...(this._description ? { description: this._description } : {}),
          ...(this._sensitive !== undefined ? { sensitive: this._sensitive } : {}),
          ...(this._dependsOn?.length ? { depends_on: this._dependsOn } : {}),
        },
      },
    };
  }
}
