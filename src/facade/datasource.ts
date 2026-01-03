import { Construct } from "./construct.js";
import type { TerraformStack } from "./stack.js";
import type { TerraformProvider } from "./provider.js";
import type { Token } from "../core/tokens.js";
import { raw } from "../core/tokens.js";
import { generateLogicalId, generateFqn } from "../core/logical-id.js";
import { TerraformResource } from "./resource.js";

export type TerraformDataSourceConfig = {
  readonly dependsOn?: readonly Construct[];
  readonly provider?: TerraformProvider;
};

export abstract class TerraformDataSource extends Construct {
  readonly terraformResourceType: string;
  readonly friendlyUniqueId: string;
  readonly fqn: string;

  dependsOn?: Construct[];
  provider?: TerraformProvider;

  constructor(
    scope: TerraformStack,
    id: string,
    terraformResourceType: string,
    config: TerraformDataSourceConfig = {},
  ) {
    super(scope, id, {
      kind: "datasource",
      datasource: {
        terraformResourceType,
        config: {},
      },
    });

    this.terraformResourceType = terraformResourceType;
    this.friendlyUniqueId = generateLogicalId(this.node.path);
    this.fqn = generateFqn(`data.${terraformResourceType}`, this.friendlyUniqueId);

    if (config.dependsOn !== undefined) {
      this.dependsOn = [...config.dependsOn];
    }
    this.provider = config.provider;
  }

  interpolationForAttribute(attribute: string): Token {
    return raw(`data.${this.terraformResourceType}.${this.friendlyUniqueId}.${attribute}`);
  }

  protected abstract synthesizeAttributes(): Record<string, unknown>;

  synthesizeDataSourceDef(): {
    readonly terraformResourceType: string;
    readonly provider?: string;
    readonly dependsOn?: readonly Token[];
    readonly config: Readonly<Record<string, unknown>>;
  } {
    const dependsOnTokens =
      this.dependsOn?.map((c) => {
        if (c instanceof TerraformResource) {
          return raw(`${c.terraformResourceType}.${c.friendlyUniqueId}`);
        }
        if (c instanceof TerraformDataSource) {
          return raw(`data.${c.terraformResourceType}.${c.friendlyUniqueId}`);
        }
        return raw(c.node.id);
      }) ?? undefined;

    return {
      terraformResourceType: this.terraformResourceType,
      provider: this.provider?.fqn,
      dependsOn: dependsOnTokens,
      config: this.synthesizeAttributes(),
    };
  }
}
