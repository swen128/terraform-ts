import { z } from "zod";
import { Construct } from "./construct.js";
import type { TerraformStack } from "./terraform-stack.js";

const ContextSchema = z.record(z.string(), z.unknown());

const APP_SYMBOL = Symbol.for("tfts/App");
export const CONTEXT_ENV = "CDKTF_CONTEXT_JSON";

export interface AppConfig {
  readonly outdir?: string;
  readonly stackTraces?: boolean;
  readonly hclOutput?: boolean;
  readonly context?: Record<string, unknown>;
  readonly skipValidation?: boolean;
  readonly skipBackendValidation?: boolean;
}

export interface Manifest {
  readonly version: string;
  readonly outdir: string;
  readonly hclOutput: boolean;
  stacks: Record<string, StackManifest>;
}

export interface StackManifest {
  readonly name: string;
  readonly constructPath: string;
  readonly synthesizedStackPath: string;
  readonly workingDirectory: string;
  readonly annotations: Annotation[];
  readonly dependencies: string[];
}

export interface Annotation {
  readonly constructPath: string;
  readonly level: "info" | "warning" | "error";
  readonly message: string;
  readonly stacktrace?: string[];
}

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

  static isApp(x: unknown): x is App {
    return x !== null && typeof x === "object" && APP_SYMBOL in x;
  }

  static of(construct: Construct): App {
    let current: Construct | undefined = construct;
    while (current) {
      if (App.isApp(current)) {
        return current;
      }
      current = current._scope;
    }
    throw new Error(`No App found in the scope of ${construct.node.path}`);
  }

  synth(): void {
    if (this._synthesized) {
      return;
    }

    const stacks = this.node
      .findAll()
      .filter(
        (c): c is TerraformStack =>
          "isStack" in c.constructor &&
          (c.constructor as { isStack?: (x: unknown) => boolean }).isStack?.(c) === true,
      );

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
        throw new Error(`Validation failed:\n  ${errors.join("\n  ")}`);
      }
    }

    this.writeManifest();
    this._synthesized = true;
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
    const fs = require("fs");
    const path = require("path");

    if (!fs.existsSync(this.outdir)) {
      fs.mkdirSync(this.outdir, { recursive: true });
    }

    const manifestPath = path.join(this.outdir, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(this.manifest, null, 2));
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
