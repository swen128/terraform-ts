import { ok, err, type Result } from "neverthrow";
import { Construct } from "./construct.js";
import type { TerraformStack } from "./stack.js";
import type { TerraformJson } from "../core/terraform-json.js";
import type { ValidationError } from "../core/errors.js";
import { synthesizeStack } from "../core/synthesize.js";
import { validateTree } from "../core/validate.js";

export type AppOptions = {
  readonly outdir?: string;
};

export class App extends Construct {
  private readonly stacks: TerraformStack[] = [];
  readonly outdir: string;

  constructor(options: AppOptions = {}) {
    const outdir = options.outdir ?? process.env.CDKTF_OUTDIR ?? "cdktf.out";
    super(undefined, "app", { kind: "app", outdir });
    this.outdir = outdir;
  }

  registerStack(stack: TerraformStack): void {
    this.stacks.push(stack);
  }

  synth(): Result<ReadonlyMap<string, TerraformJson>, readonly ValidationError[]> {
    const errors = validateTree(this.node);
    if (errors.length > 0) {
      return err(errors);
    }

    const result = new Map<string, TerraformJson>();
    for (const stack of this.stacks) {
      result.set(stack.stackName, synthesizeStack(stack.node));
    }
    return ok(result);
  }

  static of(construct: Construct): App | undefined {
    const current: Construct | undefined = construct;
    if (current instanceof App) {
      return current;
    }
    return undefined;
  }
}
