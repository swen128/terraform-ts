import { createToken, ref } from "../core/tokens.js";
import type { Construct } from "./construct.js";
import { TerraformElement } from "./terraform-element.js";
import type { ITerraformIterator, TerraformCount } from "./terraform-iterator.js";
import type { TerraformProvider } from "./terraform-provider.js";
import type { ITerraformDependable } from "./terraform-resource.js";

const DATASOURCE_SYMBOL = Symbol.for("tfts/TerraformDataSource");

export interface TerraformDataSourceConfig {
  readonly terraformResourceType: string;
  readonly terraformGeneratorMetadata?: {
    readonly providerName: string;
    readonly providerVersion?: string;
  };
  readonly dependsOn?: ITerraformDependable[];
  readonly count?: number | TerraformCount;
  readonly provider?: TerraformProvider;
  readonly forEach?: ITerraformIterator;
}

export class TerraformDataSource extends TerraformElement implements ITerraformDependable {
  public readonly terraformResourceType: string;
  public readonly terraformGeneratorMetadata?: {
    readonly providerName: string;
    readonly providerVersion?: string;
  };

  public dependsOn?: string[];
  public count?: number | TerraformCount;
  public provider?: TerraformProvider;
  public forEach?: ITerraformIterator;

  constructor(scope: Construct, id: string, config: TerraformDataSourceConfig) {
    super(scope, id, `data.${config.terraformResourceType}`);
    Object.defineProperty(this, DATASOURCE_SYMBOL, { value: true });

    this.terraformResourceType = config.terraformResourceType;
    this.terraformGeneratorMetadata = config.terraformGeneratorMetadata;

    if (config.dependsOn) {
      this.dependsOn = config.dependsOn.map((d) => d.fqn);
    }
    this.count = config.count;
    this.provider = config.provider;
    this.forEach = config.forEach;
  }

  static isTerraformDataSource(x: unknown): x is TerraformDataSource {
    return x !== null && typeof x === "object" && DATASOURCE_SYMBOL in x;
  }

  interpolationForAttribute(attribute: string): string {
    const suffix = this.forEach ? ".*" : "";
    const token = ref(
      `data.${this.terraformResourceType}.${this.friendlyUniqueId}${suffix}`,
      attribute,
    );
    return createToken(token);
  }

  getStringAttribute(attribute: string): string {
    return this.interpolationForAttribute(attribute);
  }

  getNumberAttribute(attribute: string): number {
    return Number(this.interpolationForAttribute(attribute));
  }

  getListAttribute(attribute: string): string[] {
    return [this.interpolationForAttribute(attribute)];
  }

  getBooleanAttribute(attribute: string): boolean {
    return Boolean(this.interpolationForAttribute(attribute));
  }

  getStringMapAttribute(attribute: string): Record<string, string> {
    return { "": this.interpolationForAttribute(attribute) };
  }

  getNumberMapAttribute(attribute: string): Record<string, number> {
    return { "": Number(this.interpolationForAttribute(attribute)) };
  }

  getBooleanMapAttribute(attribute: string): Record<string, boolean> {
    return { "": Boolean(this.interpolationForAttribute(attribute)) };
  }

  getNumberListAttribute(attribute: string): number[] {
    return [Number(this.interpolationForAttribute(attribute))];
  }

  protected synthesizeAttributes(): Record<string, unknown> {
    return {};
  }

  private get terraformMetaArguments(): Record<string, unknown> {
    return {
      ...(this.dependsOn?.length ? { depends_on: this.dependsOn } : {}),
      ...(this.count !== undefined
        ? {
            count: typeof this.count === "number" ? this.count : this.count.toNumber(),
          }
        : {}),
      ...(this.provider ? { provider: this.provider.fqn } : {}),
      ...(this.forEach ? { for_each: this.forEach._getForEachExpression() } : {}),
    };
  }

  override toTerraform(): Record<string, unknown> {
    const attributes = {
      ...this.synthesizeAttributes(),
      ...this.terraformMetaArguments,
      ...this.rawOverrides,
    };

    return {
      data: {
        [this.terraformResourceType]: {
          [this.friendlyUniqueId]: attributes,
        },
      },
    };
  }
}
