import type { Construct } from "./construct.js";
import type { ElementKind } from "./terraform-element.js";
import { TerraformElement } from "./terraform-element.js";

export type TerraformProviderConfig = {
  readonly terraformResourceType: string;
  readonly terraformProviderSource: string;
  readonly terraformGeneratorMetadata?: {
    readonly providerName: string;
    readonly providerVersion?: string;
  };
  readonly alias?: string;
};

export abstract class TerraformProvider extends TerraformElement {
  readonly kind: ElementKind = "provider";

  public readonly terraformResourceType: string;
  public readonly terraformProviderSource: string;
  public readonly alias?: string;
  public readonly terraformGeneratorMetadata?: {
    readonly providerName: string;
    readonly providerVersion?: string;
  };

  constructor(scope: Construct, id: string, config: TerraformProviderConfig) {
    super(scope, id);

    this.terraformResourceType = config.terraformResourceType;
    this.terraformProviderSource = config.terraformProviderSource;
    this.alias = config.alias;
    this.terraformGeneratorMetadata = config.terraformGeneratorMetadata;
  }

  override get fqn(): string {
    if (this.alias !== undefined && this.alias !== "") {
      return `${this.terraformResourceType}.${this.alias}`;
    }
    return this.terraformResourceType;
  }

  override toTerraform(): Record<string, unknown> {
    const config = this.synthesizeAttributes();
    const providerConfig: Record<string, unknown> = { ...config };
    if (this.alias !== undefined && this.alias !== "") {
      providerConfig["alias"] = this.alias;
    }

    const requiredProvider: Record<string, unknown> = {
      source: this.terraformProviderSource,
    };
    if (this.terraformGeneratorMetadata?.providerVersion !== undefined) {
      requiredProvider["version"] = this.terraformGeneratorMetadata.providerVersion;
    }

    return {
      provider: {
        [this.terraformResourceType]: [providerConfig],
      },
      terraform: {
        required_providers: {
          [this.terraformResourceType]: requiredProvider,
        },
      },
    };
  }

  protected synthesizeAttributes(): Record<string, unknown> {
    return {};
  }
}
