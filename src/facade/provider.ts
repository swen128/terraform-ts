import { Construct } from "./construct.js";

export type TerraformProviderConfig = {
  readonly alias?: string;
};

export abstract class TerraformProvider extends Construct {
  static readonly tfResourceType: string;

  readonly terraformProviderSource: string;
  readonly version?: string;
  readonly alias?: string;
  readonly fqn: string;

  protected constructor(
    scope: Construct,
    id: string,
    terraformProviderSource: string,
    providerConfig: Readonly<Record<string, unknown>>,
    config: TerraformProviderConfig = {},
  ) {
    super(scope, id, {
      kind: "provider",
      provider: {
        terraformProviderSource,
        version: undefined,
        alias: config.alias,
        config: providerConfig,
      },
    });

    this.terraformProviderSource = terraformProviderSource;
    this.version = undefined;
    this.alias = config.alias;

    const providerName = terraformProviderSource.split("/").pop() ?? terraformProviderSource;
    this.fqn = config.alias !== undefined ? `${providerName}.${config.alias}` : providerName;
  }
}
