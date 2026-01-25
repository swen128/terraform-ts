import { createToken, type IResolvable, type IResolveContext, ref } from "../core/tokens.js";
import type { Construct } from "./construct.js";
import type { IInterpolatingParent } from "./terraform-addressable.js";
import type { ElementKind } from "./terraform-element.js";
import { TerraformElement } from "./terraform-element.js";
import type { ITerraformIterator, TerraformCount } from "./terraform-iterator.js";
import type { TerraformProvider } from "./terraform-provider.js";
import type { ITerraformDependable } from "./terraform-resource.js";

export type TerraformDataSourceMetaArguments = {
  readonly dependsOn?: ITerraformDependable[];
  readonly count?: number | TerraformCount;
  readonly provider?: TerraformProvider;
  readonly forEach?: ITerraformIterator;
};

export type TerraformDataSourceConfig = TerraformDataSourceMetaArguments & {
  readonly terraformResourceType: string;
  readonly terraformGeneratorMetadata?: {
    readonly providerName: string;
    readonly providerVersion?: string;
  };
};

export class TerraformDataSource
  extends TerraformElement
  implements ITerraformDependable, IInterpolatingParent
{
  readonly kind: ElementKind = "data-source";

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

    this.terraformResourceType = config.terraformResourceType;
    this.terraformGeneratorMetadata = config.terraformGeneratorMetadata;

    if (config.dependsOn !== undefined) {
      this.dependsOn = config.dependsOn.map((d) => d.fqn);
    }
    this.count = config.count;
    this.provider = config.provider;
    this.forEach = config.forEach;
  }

  interpolationForAttribute(attribute: string): IResolvable {
    const suffix = this.forEach !== undefined ? ".*" : "";
    const token = ref(
      `data.${this.terraformResourceType}.${this.friendlyUniqueId}${suffix}`,
      attribute,
    );
    const tokenStr = createToken(token);
    return {
      creationStack: [],
      resolve(_context: IResolveContext): unknown {
        return tokenStr;
      },
      toString(): string {
        return tokenStr;
      },
    };
  }

  getStringAttribute(attribute: string): string {
    return this.interpolationForAttribute(attribute).toString();
  }

  getNumberAttribute(attribute: string): number {
    return Number(this.interpolationForAttribute(attribute).toString());
  }

  getListAttribute(attribute: string): string[] {
    return [this.interpolationForAttribute(attribute).toString()];
  }

  getBooleanAttribute(attribute: string): IResolvable {
    return this.interpolationForAttribute(attribute);
  }

  getStringMapAttribute(attribute: string): Record<string, string> {
    return { "": this.interpolationForAttribute(attribute).toString() };
  }

  getNumberMapAttribute(attribute: string): Record<string, number> {
    return { "": Number(this.interpolationForAttribute(attribute).toString()) };
  }

  getBooleanMapAttribute(attribute: string): Record<string, IResolvable> {
    return { "": this.interpolationForAttribute(attribute) };
  }

  getNumberListAttribute(attribute: string): number[] {
    return [Number(this.interpolationForAttribute(attribute).toString())];
  }

  protected synthesizeAttributes(): Record<string, unknown> {
    return {};
  }

  private get terraformMetaArguments(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    if (this.dependsOn !== undefined && this.dependsOn.length > 0) {
      result["depends_on"] = this.dependsOn;
    }
    if (this.count !== undefined) {
      result["count"] = typeof this.count === "number" ? this.count : this.count.toNumber();
    }
    if (this.provider !== undefined) {
      result["provider"] = this.provider.fqn;
    }
    if (this.forEach !== undefined) {
      result["for_each"] = this.forEach._getForEachExpression();
    }
    return result;
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
