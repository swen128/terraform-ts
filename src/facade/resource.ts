import { Construct } from "./construct.js";
import type { TerraformProvider } from "./provider.js";
import type { LifecycleDef, ProvisionerDef } from "../core/resource.js";
import type { Token } from "../core/tokens.js";
import { raw, TokenString } from "../core/tokens.js";
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

  protected constructor(
    scope: Construct,
    id: string,
    terraformResourceType: string,
    resourceConfig: Readonly<Record<string, unknown>>,
    config: TerraformResourceConfig = {},
  ) {
    super(scope, id, {
      kind: "resource",
      resource: {
        terraformResourceType,
        config: resourceConfig,
        lifecycle: config.lifecycle,
        provisioners: config.provisioners,
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
    return raw(`\${${this.terraformResourceType}.${this.friendlyUniqueId}.${attribute}}`);
  }

  getStringAttribute(attribute: string): TokenString {
    return new TokenString(
      raw(`\${${this.terraformResourceType}.${this.friendlyUniqueId}.${attribute}}`),
    );
  }
}
