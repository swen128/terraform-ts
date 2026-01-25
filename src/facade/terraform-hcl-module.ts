import type { IResolvable, IResolveContext } from "../core/tokens.js";
import type { Construct } from "./construct.js";
import { TerraformModule, type TerraformModuleConfig } from "./terraform-module.js";

export type TerraformHclModuleConfig = TerraformModuleConfig & {
  readonly variables?: Record<string, unknown>;
};

export class TerraformHclModule extends TerraformModule {
  private _variables?: Record<string, unknown>;

  constructor(scope: Construct, id: string, options: TerraformHclModuleConfig) {
    super(scope, id, options);
    this._variables = options.variables;
  }

  get variables(): Record<string, unknown> | undefined {
    return this._variables;
  }

  set(variable: string, value: unknown): void {
    if (this._variables === undefined) {
      this._variables = {};
    }
    this._variables[variable] = value;
  }

  get(output: string): unknown {
    return this.interpolationForOutput(output);
  }

  getNumber(output: string): number {
    const tokenStr = this.interpolationForOutput(output);
    return Number(tokenStr);
  }

  getBoolean(output: string): IResolvable {
    const tokenStr = this.interpolationForOutput(output);
    return {
      creationStack: [],
      resolve: (_ctx: IResolveContext) => tokenStr,
      toString: () => tokenStr,
    };
  }

  getList(output: string): string[] {
    return [this.interpolationForOutput(output)];
  }

  protected override synthesizeAttributes(): Record<string, unknown> {
    return { ...this._variables };
  }
}
