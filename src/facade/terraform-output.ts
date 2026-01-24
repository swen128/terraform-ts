import type { Construct } from "./construct.js";
import type { ElementKind } from "./terraform-element.js";
import { TerraformElement } from "./terraform-element.js";

export type TerraformOutputConfig = {
  readonly value: unknown;
  readonly description?: string;
  readonly sensitive?: boolean;
  readonly dependsOn?: string[];
};

export class TerraformOutput extends TerraformElement {
  readonly kind: ElementKind = "output";

  private readonly _value: unknown;
  private readonly _description?: string;
  private readonly _sensitive?: boolean;
  private readonly _dependsOn?: string[];

  constructor(scope: Construct, id: string, config: TerraformOutputConfig) {
    super(scope, id);

    this._value = config.value;
    this._description = config.description;
    this._sensitive = config.sensitive;
    this._dependsOn = config.dependsOn;
  }

  get value(): unknown {
    return this._value;
  }

  override toTerraform(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      value: this._value,
    };
    if (this._description !== undefined && this._description !== "") {
      result["description"] = this._description;
    }
    if (this._sensitive !== undefined) {
      result["sensitive"] = this._sensitive;
    }
    if (this._dependsOn !== undefined && this._dependsOn.length > 0) {
      result["depends_on"] = this._dependsOn;
    }
    return {
      output: {
        [this.friendlyUniqueId]: result,
      },
    };
  }
}
