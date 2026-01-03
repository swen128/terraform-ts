import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Construct } from "./construct.js";
import type { TerraformStack } from "./stack.js";
import type { ValidationError } from "../core/errors.js";
import { synthesizeStack } from "../core/synthesize.js";
import { validateTree } from "../core/validate.js";

export type AppOptions = {
  readonly outdir?: string;
};

export type Manifest = {
  readonly version: string;
  readonly stacks: Record<string, ManifestStack>;
};

export type ManifestStack = {
  readonly name: string;
  readonly synthesizedStackPath: string;
  readonly workingDirectory: string;
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

  synth(): void {
    const errors = validateTree(this.node);
    if (errors.length > 0) {
      const messages = errors.map((e: ValidationError) => `[${e.path}] ${e.message}`);
      throw new Error(`Validation failed:\n${messages.join("\n")}`);
    }

    if (!existsSync(this.outdir)) {
      mkdirSync(this.outdir, { recursive: true });
    }

    const manifestStacks: Record<string, ManifestStack> = {};

    for (const stack of this.stacks) {
      const stackDir = join(this.outdir, "stacks", stack.stackName);
      if (!existsSync(stackDir)) {
        mkdirSync(stackDir, { recursive: true });
      }

      const json = synthesizeStack(stack.node);
      const outputPath = join(stackDir, "cdk.tf.json");
      writeFileSync(outputPath, JSON.stringify(json, null, 2));

      manifestStacks[stack.stackName] = {
        name: stack.stackName,
        synthesizedStackPath: `stacks/${stack.stackName}/cdk.tf.json`,
        workingDirectory: `stacks/${stack.stackName}`,
      };
    }

    const manifest: Manifest = {
      version: "1.0.0",
      stacks: manifestStacks,
    };
    writeFileSync(join(this.outdir, "manifest.json"), JSON.stringify(manifest, null, 2));
  }

  static of(construct: Construct): App | undefined {
    const current: Construct | undefined = construct;
    if (current instanceof App) {
      return current;
    }
    return undefined;
  }
}
