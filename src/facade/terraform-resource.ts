import { createToken, ref } from "../core/tokens.js";
import type { Construct } from "./construct.js";
import type { ITerraformDependable } from "./terraform-addressable.js";
import type { ElementKind } from "./terraform-element.js";
import { TerraformElement } from "./terraform-element.js";
import type { ITerraformIterator, TerraformCount } from "./terraform-iterator.js";
import type { TerraformProvider } from "./terraform-provider.js";
import { deepMerge, type JsonObject } from "./util.js";

export type { ITerraformDependable } from "./terraform-addressable.js";

export type TerraformResourceLifecycle = {
  readonly createBeforeDestroy?: boolean;
  readonly preventDestroy?: boolean;
  readonly ignoreChanges?: string[] | "all";
  readonly replaceTriggeredBy?: string[];
};

export type TerraformMetaArguments = {
  readonly dependsOn?: ITerraformDependable[];
  readonly count?: number | TerraformCount;
  readonly provider?: TerraformProvider;
  readonly lifecycle?: TerraformResourceLifecycle;
  readonly forEach?: ITerraformIterator;
};

export type TerraformResourceConfig = TerraformMetaArguments & {
  readonly terraformResourceType: string;
  readonly terraformGeneratorMetadata?: {
    readonly providerName: string;
    readonly providerVersion?: string;
  };
};

export class TerraformResource extends TerraformElement implements ITerraformDependable {
  readonly kind: ElementKind = "resource";

  public readonly terraformResourceType: string;
  public readonly terraformGeneratorMetadata?: {
    readonly providerName: string;
    readonly providerVersion?: string;
  };

  public dependsOn?: string[];
  public count?: number | TerraformCount;
  public provider?: TerraformProvider;
  public lifecycle?: TerraformResourceLifecycle;
  public forEach?: ITerraformIterator;

  constructor(scope: Construct, id: string, config: TerraformResourceConfig) {
    super(scope, id, config.terraformResourceType);

    this.terraformResourceType = config.terraformResourceType;
    this.terraformGeneratorMetadata = config.terraformGeneratorMetadata;

    if (config.dependsOn !== undefined) {
      this.dependsOn = config.dependsOn.map((d) => d.fqn);
    }
    this.count = config.count;
    this.provider = config.provider;
    this.lifecycle = config.lifecycle;
    this.forEach = config.forEach;
  }

  interpolationForAttribute(attribute: string): string {
    const suffix = this.forEach !== undefined ? ".*" : "";
    const token = ref(`${this.terraformResourceType}.${this.friendlyUniqueId}${suffix}`, attribute);
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
    if (this.lifecycle !== undefined) {
      result["lifecycle"] = this.synthesizeLifecycle();
    }
    if (this.forEach !== undefined) {
      result["for_each"] = this.forEach._getForEachExpression();
    }
    return result;
  }

  private synthesizeLifecycle(): Record<string, unknown> {
    if (this.lifecycle === undefined) return {};

    const result: Record<string, unknown> = {};
    if (this.lifecycle.createBeforeDestroy !== undefined) {
      result["create_before_destroy"] = this.lifecycle.createBeforeDestroy;
    }
    if (this.lifecycle.preventDestroy !== undefined) {
      result["prevent_destroy"] = this.lifecycle.preventDestroy;
    }
    if (this.lifecycle.ignoreChanges !== undefined) {
      result["ignore_changes"] = this.lifecycle.ignoreChanges;
    }
    if (
      this.lifecycle.replaceTriggeredBy !== undefined &&
      this.lifecycle.replaceTriggeredBy.length > 0
    ) {
      result["replace_triggered_by"] = this.lifecycle.replaceTriggeredBy;
    }
    return result;
  }

  override toTerraform(): Record<string, unknown> {
    const base: JsonObject = {
      ...this.synthesizeAttributes(),
      ...this.terraformMetaArguments,
    };
    const attributes = deepMerge(base, this.rawOverrides);

    return {
      resource: {
        [this.terraformResourceType]: {
          [this.friendlyUniqueId]: attributes,
        },
      },
    };
  }

  override toMetadata(): Record<string, unknown> {
    if (Object.keys(this.rawOverrides).length > 0) {
      return { overrides: { [this.terraformResourceType]: Object.keys(this.rawOverrides) } };
    }
    return {};
  }
}
