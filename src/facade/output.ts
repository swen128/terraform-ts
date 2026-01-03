import { Construct } from "./construct.js";
import type { TerraformStack } from "./stack.js";

export type TerraformOutputConfig = {
  readonly value: unknown;
  readonly description?: string;
  readonly sensitive?: boolean;
  readonly dependsOn?: readonly Construct[];
};

export class TerraformOutput extends Construct {
  readonly value: unknown;
  readonly description?: string;
  readonly sensitive?: boolean;
  readonly staticId: string;

  private readonly dependsOnConstructs?: Construct[];

  constructor(scope: TerraformStack, id: string, config: TerraformOutputConfig) {
    super(scope, id, {
      kind: "output",
      output: {
        value: config.value,
        description: config.description,
        sensitive: config.sensitive,
      },
    });

    this.value = config.value;
    this.description = config.description;
    this.sensitive = config.sensitive;
    this.staticId = id;

    if (config.dependsOn !== undefined) {
      this.dependsOnConstructs = [...config.dependsOn];
    }
  }

  get dependsOn(): readonly Construct[] | undefined {
    return this.dependsOnConstructs;
  }
}
