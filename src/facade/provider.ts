import { Construct } from "./construct.js";
import type { TerraformStack } from "./stack.js";

export type TerraformProviderConfig = {
  readonly alias?: string;
};

export abstract class TerraformProvider extends Construct {
  static readonly tfResourceType: string;

  readonly terraformProviderSource: string;
  readonly version?: string;
  readonly alias?: string;
  readonly fqn: string;

  constructor(
    scope: TerraformStack,
    id: string,
    terraformProviderSource: string,
    version: string | undefined,
    config: TerraformProviderConfig = {},
  ) {
    super(scope, id, {
      kind: "provider",
      provider: {
        terraformProviderSource,
        version,
        alias: config.alias,
        config: {},
      },
    });

    this.terraformProviderSource = terraformProviderSource;
    this.version = version;
    this.alias = config.alias;

    const providerName = terraformProviderSource.split("/").pop() ?? terraformProviderSource;
    this.fqn = config.alias !== undefined ? `${providerName}.${config.alias}` : providerName;
  }

  protected abstract synthesizeAttributes(): Record<string, unknown>;

  synthesizeProviderDef(): {
    readonly terraformProviderSource: string;
    readonly version?: string;
    readonly alias?: string;
    readonly config: Readonly<Record<string, unknown>>;
  } {
    return {
      terraformProviderSource: this.terraformProviderSource,
      version: this.version,
      alias: this.alias,
      config: this.synthesizeAttributes(),
    };
  }
}
