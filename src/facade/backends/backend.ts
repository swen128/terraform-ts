import { Construct } from "../construct.js";
import type { TerraformStack } from "../stack.js";

export abstract class TerraformBackend extends Construct {
  readonly backendType: string;

  constructor(scope: TerraformStack, backendType: string) {
    super(scope, "backend", {
      kind: "backend",
      backend: {
        type: backendType,
        config: {},
      },
    });

    this.backendType = backendType;
  }

  protected abstract synthesizeAttributes(): Record<string, unknown>;

  synthesizeBackendDef(): {
    readonly type: string;
    readonly config: Readonly<Record<string, unknown>>;
  } {
    return {
      type: this.backendType,
      config: this.synthesizeAttributes(),
    };
  }
}
