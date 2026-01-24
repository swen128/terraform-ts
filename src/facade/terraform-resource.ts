import { createToken, ref } from "../core/tokens.js";
import type { Construct } from "./construct.js";
import { TerraformElement } from "./terraform-element.js";
import type { ITerraformIterator, TerraformCount } from "./terraform-iterator.js";
import type { TerraformProvider } from "./terraform-provider.js";

const RESOURCE_SYMBOL = Symbol.for("tfts/TerraformResource");

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

export type ITerraformDependable = {
  readonly fqn: string;
};

export type TerraformResourceConfig = TerraformMetaArguments & {
  readonly terraformResourceType: string;
  readonly terraformGeneratorMetadata?: {
    readonly providerName: string;
    readonly providerVersion?: string;
  };
};

export class TerraformResource extends TerraformElement implements ITerraformDependable {
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
    Object.defineProperty(this, RESOURCE_SYMBOL, { value: true });

    this.terraformResourceType = config.terraformResourceType;
    this.terraformGeneratorMetadata = config.terraformGeneratorMetadata;

    if (config.dependsOn) {
      this.dependsOn = config.dependsOn.map((d) => d.fqn);
    }
    this.count = config.count;
    this.provider = config.provider;
    this.lifecycle = config.lifecycle;
    this.forEach = config.forEach;
  }

  static isTerraformResource(x: unknown): x is TerraformResource {
    return x !== null && typeof x === "object" && RESOURCE_SYMBOL in x;
  }

  interpolationForAttribute(attribute: string): string {
    const suffix = this.forEach ? ".*" : "";
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
    return {
      ...(this.dependsOn?.length ? { depends_on: this.dependsOn } : {}),
      ...(this.count !== undefined
        ? {
            count: typeof this.count === "number" ? this.count : this.count.toNumber(),
          }
        : {}),
      ...(this.provider ? { provider: this.provider.fqn } : {}),
      ...(this.lifecycle ? { lifecycle: this.synthesizeLifecycle() } : {}),
      ...(this.forEach ? { for_each: this.forEach._getForEachExpression() } : {}),
    };
  }

  private synthesizeLifecycle(): Record<string, unknown> {
    if (!this.lifecycle) return {};

    return {
      ...(this.lifecycle.createBeforeDestroy !== undefined
        ? { create_before_destroy: this.lifecycle.createBeforeDestroy }
        : {}),
      ...(this.lifecycle.preventDestroy !== undefined
        ? { prevent_destroy: this.lifecycle.preventDestroy }
        : {}),
      ...(this.lifecycle.ignoreChanges ? { ignore_changes: this.lifecycle.ignoreChanges } : {}),
      ...(this.lifecycle.replaceTriggeredBy?.length
        ? { replace_triggered_by: this.lifecycle.replaceTriggeredBy }
        : {}),
    };
  }

  override toTerraform(): Record<string, unknown> {
    const attributes = {
      ...this.synthesizeAttributes(),
      ...this.terraformMetaArguments,
      ...this.rawOverrides,
    };

    return {
      resource: {
        [this.terraformResourceType]: {
          [this.friendlyUniqueId]: attributes,
        },
      },
    };
  }

  override toMetadata(): Record<string, unknown> {
    return {
      ...(Object.keys(this.rawOverrides).length
        ? { overrides: { [this.terraformResourceType]: Object.keys(this.rawOverrides) } }
        : {}),
    };
  }
}
