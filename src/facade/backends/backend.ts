import { Construct } from "../construct.js";
import type { TerraformStack } from "../stack.js";

export abstract class TerraformBackend extends Construct {
  readonly backendType: string;

  constructor(
    scope: TerraformStack,
    backendType: string,
    config: Readonly<Record<string, unknown>>,
  ) {
    super(scope, "backend", {
      kind: "backend",
      backend: {
        type: backendType,
        config,
      },
    });

    this.backendType = backendType;
  }
}
