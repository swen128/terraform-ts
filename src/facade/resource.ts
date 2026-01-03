import { Construct } from "./construct.js";
import type { TerraformStack } from "./stack.js";
import type { TerraformProvider } from "./provider.js";
import type { LifecycleDef, ProvisionerDef } from "../core/resource.js";
import type { Token } from "../core/tokens.js";
import { raw } from "../core/tokens.js";
import { generateLogicalId, generateFqn } from "../core/logical-id.js";

export type TerraformResourceLifecycle = LifecycleDef;

export type TerraformResourceConfig = {
  readonly dependsOn?: readonly Construct[];
  readonly count?: number | Token;
  readonly forEach?: Token;
  readonly provider?: TerraformProvider;
  readonly lifecycle?: TerraformResourceLifecycle;
  readonly provisioners?: readonly ProvisionerDef[];
};

export abstract class TerraformResource extends Construct {
  readonly terraformResourceType: string;
  readonly friendlyUniqueId: string;
  readonly fqn: string;

  dependsOn?: Construct[];
  count?: number | Token;
  forEach?: Token;
  provider?: TerraformProvider;
  lifecycle?: TerraformResourceLifecycle;
  provisioners?: ProvisionerDef[];

  private readonly overrides: Map<string, unknown> = new Map();

  constructor(
    scope: TerraformStack,
    id: string,
    terraformResourceType: string,
    config: TerraformResourceConfig = {},
  ) {
    super(scope, id, {
      kind: "resource",
      resource: {
        terraformResourceType,
        config: {},
      },
    });

    this.terraformResourceType = terraformResourceType;
    this.friendlyUniqueId = generateLogicalId(this.node.path);
    this.fqn = generateFqn(terraformResourceType, this.friendlyUniqueId);

    if (config.dependsOn !== undefined) {
      this.dependsOn = [...config.dependsOn];
    }
    this.count = config.count;
    this.forEach = config.forEach;
    this.provider = config.provider;
    this.lifecycle = config.lifecycle;
    if (config.provisioners !== undefined) {
      this.provisioners = [...config.provisioners];
    }
  }

  addOverride(path: string, value: unknown): void {
    this.overrides.set(path, value);
  }

  interpolationForAttribute(attribute: string): Token {
    return raw(`${this.terraformResourceType}.${this.friendlyUniqueId}.${attribute}`);
  }

  protected abstract synthesizeAttributes(): Record<string, unknown>;

  synthesizeResourceDef(): {
    readonly terraformResourceType: string;
    readonly provider?: string;
    readonly dependsOn?: readonly Token[];
    readonly count?: number | Token;
    readonly forEach?: Token;
    readonly lifecycle?: LifecycleDef;
    readonly provisioners?: readonly ProvisionerDef[];
    readonly config: Readonly<Record<string, unknown>>;
    readonly overrides: ReadonlyMap<string, unknown>;
  } {
    const dependsOnTokens =
      this.dependsOn?.map((c) => {
        if (c instanceof TerraformResource) {
          return raw(`${c.terraformResourceType}.${c.friendlyUniqueId}`);
        }
        return raw(c.node.id);
      }) ?? undefined;

    return {
      terraformResourceType: this.terraformResourceType,
      provider: this.provider?.fqn,
      dependsOn: dependsOnTokens,
      count: this.count,
      forEach: this.forEach,
      lifecycle: this.lifecycle,
      provisioners: this.provisioners,
      config: this.synthesizeAttributes(),
      overrides: this.overrides,
    };
  }
}
