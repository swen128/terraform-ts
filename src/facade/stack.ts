import { Construct } from "./construct.js";
import { App } from "./app.js";
import type { TerraformJson } from "../core/terraform-json.js";
import { synthesizeStack } from "../core/synthesize.js";

export class TerraformStack extends Construct {
  readonly stackName: string;
  private readonly dependencies: TerraformStack[] = [];

  constructor(scope: Construct, id: string) {
    super(scope, id, { kind: "stack", stackName: id });
    this.stackName = id;
    if (scope instanceof App) {
      scope.registerStack(this);
    }
  }

  addDependency(...stacks: TerraformStack[]): void {
    for (const stack of stacks) {
      if (!this.dependencies.includes(stack)) {
        this.dependencies.push(stack);
      }
    }
  }

  getDependencies(): readonly TerraformStack[] {
    return this.dependencies;
  }

  toTerraform(): TerraformJson {
    return synthesizeStack(this.node);
  }
}
