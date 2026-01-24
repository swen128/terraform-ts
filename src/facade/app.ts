import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { Construct } from "./construct.js";
import type { TerraformStack } from "./terraform-stack.js";

const ContextSchema = z.record(z.string(), z.unknown());

const APP_SYMBOL = Symbol.for("tfts/App");
export const CONTEXT_ENV = "CDKTF_CONTEXT_JSON";

export type AppConfig = {
  readonly outdir?: string;
  readonly stackTraces?: boolean;
  readonly hclOutput?: boolean;
  readonly context?: Record<string, unknown>;
  readonly skipValidation?: boolean;
  readonly skipBackendValidation?: boolean;
};

export type Manifest = {
  readonly version: string;
  readonly outdir: string;
  readonly hclOutput: boolean;
  stacks: Record<string, StackManifest>;
};

export type StackManifest = {
  readonly name: string;
  readonly constructPath: string;
  readonly synthesizedStackPath: string;
  readonly workingDirectory: string;
  readonly annotations: Annotation[];
  readonly dependencies: string[];
};

export type Annotation = {
  readonly constructPath: string;
  readonly level: "info" | "warning" | "error";
  readonly message: string;
  readonly stacktrace?: string[];
};

export class App extends Construct {
  public readonly outdir: string;
  public readonly hclOutput: boolean;
  public readonly targetStackId: string | undefined;
  public readonly skipValidation: boolean;
  public readonly skipBackendValidation: boolean;
  public readonly manifest: Manifest;

  private _synthesized = false;

  constructor(config: AppConfig = {}) {
    super(undefined, "");
    Object.defineProperty(this, APP_SYMBOL, { value: true });

    this.outdir = config.outdir ?? process.env["CDKTF_OUTDIR"] ?? "cdktf.out";

    const envHclOutput = process.env["SYNTH_HCL_OUTPUT"];
    this.hclOutput =
      envHclOutput !== undefined ? envHclOutput === "true" : (config.hclOutput ?? false);

    this.targetStackId = process.env["CDKTF_TARGET_STACK_ID"];
    this.skipValidation = config.skipValidation ?? false;
    this.skipBackendValidation = config.skipBackendValidation ?? false;

    this.loadContext(config.context);

    if (config.stackTraces === false) {
      this.node.setContext("DISABLE_STACK_TRACE_IN_METADATA", true);
    }

    this.node.setContext("cdktfVersion", "0.0.0");

    this.manifest = {
      version: "0.0.0",
      outdir: this.outdir,
      hclOutput: this.hclOutput,
      stacks: {},
    };
  }

  static asApp(x: unknown): App | null {
    if (x === null || typeof x !== "object") {
      return null;
    }
    if (Object.prototype.hasOwnProperty.call(x, APP_SYMBOL)) {
      return x as App;
    }
    return null;
  }

  static of(construct: Construct): App | null {
    let current: Construct | undefined = construct;
    while (current !== undefined) {
      const app = App.asApp(current);
      if (app !== null) {
        return app;
      }
      current = current._scope;
    }
    return null;
  }

  synth(): void {
    if (this._synthesized) {
      return;
    }

    const stacks = this.node.findAll().flatMap((c) => {
      const stack = this.asStack(c);
      return stack !== null ? [stack] : [];
    });

    for (const stack of stacks) {
      stack.prepareStack();
    }

    for (const stack of stacks) {
      stack.synthesize();
    }

    if (!this.skipValidation) {
      const errors: string[] = [];
      for (const construct of this.node.findAll()) {
        errors.push(...construct.node.validate());
      }
      if (errors.length > 0) {
        return;
      }
    }

    this.writeManifest();
    this._synthesized = true;
  }

  private asStack(c: unknown): TerraformStack | null {
    if (c === null || typeof c !== "object") {
      return null;
    }
    const ctor = (c as { constructor: { isStack?: (x: unknown) => boolean } }).constructor;
    if (typeof ctor.isStack === "function" && ctor.isStack(c)) {
      return c as TerraformStack;
    }
    return null;
  }

  private loadContext(defaults: Record<string, unknown> = {}): void {
    for (const [k, v] of Object.entries(defaults)) {
      this.node.setContext(k, v);
    }

    const contextJson = process.env[CONTEXT_ENV];
    if (contextJson) {
      const jsonResult = z
        .string()
        .transform((s) => JSON.parse(s))
        .safeParse(contextJson);
      if (!jsonResult.success) return;

      const result = ContextSchema.safeParse(jsonResult.data);
      if (result.success) {
        for (const [k, v] of Object.entries(result.data)) {
          this.node.setContext(k, v);
        }
      }
    }
  }

  private writeManifest(): void {
    if (!existsSync(this.outdir)) {
      mkdirSync(this.outdir, { recursive: true });
    }

    const manifestPath = join(this.outdir, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify(this.manifest, null, 2));
  }

  crossStackReference(
    fromStack: TerraformStack,
    toStack: TerraformStack,
    identifier: string,
  ): string {
    toStack.addDependency(fromStack);
    const outputId = fromStack.registerOutgoingCrossStackReference(identifier);
    const remoteState = toStack.registerIncomingCrossStackReference(fromStack);
    return remoteState.getString(outputId);
  }
}
