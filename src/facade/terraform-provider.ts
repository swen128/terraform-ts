import type { Construct } from "./construct.js";
import { TerraformElement } from "./terraform-element.js";

const PROVIDER_SYMBOL = Symbol.for("tfts/TerraformProvider");

export type TerraformProviderConfig = {
  readonly terraformResourceType: string;
  readonly terraformProviderSource: string;
  readonly terraformGeneratorMetadata?: {
    readonly providerName: string;
    readonly providerVersion?: string;
  };
  readonly alias?: string;
}

export abstract class TerraformProvider extends TerraformElement {
  public readonly terraformResourceType: string;
  public readonly terraformProviderSource: string;
  public readonly alias?: string;
  public readonly terraformGeneratorMetadata?: {
    readonly providerName: string;
    readonly providerVersion?: string;
  };

  constructor(scope: Construct, id: string, config: TerraformProviderConfig) {
    super(scope, id);
    Object.defineProperty(this, PROVIDER_SYMBOL, { value: true });

    this.terraformResourceType = config.terraformResourceType;
    this.terraformProviderSource = config.terraformProviderSource;
    this.alias = config.alias;
    this.terraformGeneratorMetadata = config.terraformGeneratorMetadata;
  }

  static isTerraformProvider(x: unknown): x is TerraformProvider {
    return x !== null && typeof x === "object" && PROVIDER_SYMBOL in x;
  }

  override get fqn(): string {
    if (this.alias) {
      return `${this.terraformResourceType}.${this.alias}`;
    }
    return this.terraformResourceType;
  }

  override toTerraform(): Record<string, unknown> {
    const config = this.synthesizeAttributes();
    return {
      provider: {
        [this.terraformResourceType]: [
          {
            ...config,
            ...(this.alias ? { alias: this.alias } : {}),
          },
        ],
      },
      terraform: {
        required_providers: {
          [this.terraformResourceType]: {
            source: this.terraformProviderSource,
            ...(this.terraformGeneratorMetadata?.providerVersion
              ? { version: this.terraformGeneratorMetadata.providerVersion }
              : {}),
          },
        },
      },
    };
  }

  protected synthesizeAttributes(): Record<string, unknown> {
    return {};
  }
}
