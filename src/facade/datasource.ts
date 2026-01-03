import { Construct } from "./construct.js";
import type { TerraformStack } from "./stack.js";
import type { TerraformProvider } from "./provider.js";
import type { Token } from "../core/tokens.js";
import { raw } from "../core/tokens.js";
import { generateLogicalId, generateFqn } from "../core/logical-id.js";

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

  protected constructor(
    scope: TerraformStack,
    id: string,
    terraformResourceType: string,
    dataSourceConfig: Readonly<Record<string, unknown>>,
    config: TerraformDataSourceConfig = {},
  ) {
    super(scope, id, {
      kind: "datasource",
      datasource: {
        terraformResourceType,
        config: dataSourceConfig,
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
    return raw(`\${data.${this.terraformResourceType}.${this.friendlyUniqueId}.${attribute}}`);
  }

  getStringAttribute(attribute: string): string {
    return `\${data.${this.terraformResourceType}.${this.friendlyUniqueId}.${attribute}}`;
  }
}
