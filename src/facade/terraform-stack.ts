import * as fs from "node:fs";
import * as path from "node:path";
import { generateLogicalId } from "../core/synthesize.js";
import type { TerraformJson } from "../core/terraform-json.js";
import { resolveTokens, type Token, tokenToString } from "../core/tokens.js";
import { App } from "./app.js";
import { Construct, type IValidation } from "./construct.js";
import { registerStack } from "./stack-registry.js";
import { LocalBackend, TerraformBackend } from "./terraform-backend.js";
import type { ElementKind } from "./terraform-element.js";
import { TerraformElement } from "./terraform-element.js";
import { TerraformOutput } from "./terraform-output.js";
import { TerraformProvider } from "./terraform-provider.js";
import { TerraformRemoteState } from "./terraform-remote-state.js";
import { deepMerge } from "./util.js";

function asRecord(value: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value));
}

function toTerraformJson(obj: Record<string, unknown>): TerraformJson {
  return obj;
}

export type TerraformStackMetadata = {
  readonly stackName: string;
  readonly version: string;
  readonly backend: string;
};

export class TerraformStack extends TerraformElement {
  readonly kind: ElementKind = "stack";

  public dependencies: TerraformStack[] = [];
  private readonly _crossStackOutputs: Map<string, TerraformOutput> = new Map();
  private readonly _crossStackDataSources: Map<string, TerraformRemoteState> = new Map();

  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.node.addValidation(new ValidateProviderPresence(this));
    registerStack(this, this);
  }

  static of(construct: Construct): TerraformStack {
    const stacks = construct.node.scopes.flatMap((c) => (c instanceof TerraformStack ? [c] : []));
    const stack = stacks[0];
    if (stack === undefined) {
      throw new Error(`No TerraformStack found in scope of ${construct.node.path}`);
    }
    return stack;
  }

  get stackName(): string {
    return this.node.id;
  }

  getLogicalId(element: { node: { path: string } }): string {
    const pathParts = element.node.path.split("/");
    return generateLogicalId(pathParts);
  }

  prepareStack(): void {
    this.ensureBackendExists();
  }

  synthesize(): void {
    const app = App.of(this);
    if (app === null) {
      throw new Error(`No App found in scope of ${this.node.path}`);
    }
    const stackDir = `${app.outdir}/stacks/${this.stackName}`;

    if (!fs.existsSync(stackDir)) {
      fs.mkdirSync(stackDir, { recursive: true });
    }

    const json = this.toTerraform();
    const outputPath = path.join(stackDir, "cdk.tf.json");
    fs.writeFileSync(outputPath, JSON.stringify(json, null, 2));

    app.manifest.stacks[this.stackName] = {
      name: this.stackName,
      constructPath: this.node.path,
      synthesizedStackPath: outputPath,
      workingDirectory: stackDir,
      annotations: [],
      dependencies: this.dependencies.map((d) => d.stackName),
    };
  }

  override toTerraform(): TerraformJson {
    const elements = this.node.findAll().flatMap((c) => {
      if (c !== this && c instanceof TerraformElement) {
        return [c];
      }
      return [];
    });

    let result: TerraformJson = {
      "//": {
        metadata: {
          version: "0.0.0",
          stackName: this.stackName,
          backend: "local",
        },
      },
    };

    for (const element of elements) {
      const fragment = element.toTerraform();
      result = deepMerge(result, fragment);
    }

    const resolved = resolveTokens(result, (token: Token) => tokenToString(token));
    if (resolved === null || typeof resolved !== "object" || Array.isArray(resolved)) {
      return {};
    }
    return toTerraformJson(asRecord(resolved));
  }

  addDependency(dependency: TerraformStack): void {
    if (dependency.dependsOn(this)) {
      throw new Error(
        `Circular dependency: ${this.stackName} -> ${dependency.stackName} -> ${this.stackName}`,
      );
    }
    if (!this.dependencies.includes(dependency)) {
      this.dependencies.push(dependency);
    }
  }

  dependsOn(stack: TerraformStack): boolean {
    return this.dependencies.includes(stack) || this.dependencies.some((d) => d.dependsOn(stack));
  }

  ensureBackendExists(): TerraformBackend {
    const backends = this.node.findAll().flatMap((c) => {
      if (c instanceof TerraformBackend) {
        return [c];
      }
      return [];
    });
    if (backends.length > 0 && backends[0] !== undefined) {
      return backends[0];
    }
    return new LocalBackend(this, {});
  }

  allProviders(): TerraformProvider[] {
    return this.node.findAll().flatMap((c) => {
      if (c instanceof TerraformProvider) {
        return [c];
      }
      return [];
    });
  }

  registerOutgoingCrossStackReference(identifier: string): string {
    let output = this._crossStackOutputs.get(identifier);
    if (output === undefined) {
      output = new TerraformOutput(this, `cross-stack-output-${identifier}`, {
        value: `\${${identifier}}`,
        sensitive: true,
      });
      this._crossStackOutputs.set(identifier, output);
    }
    return output.friendlyUniqueId;
  }

  registerIncomingCrossStackReference(fromStack: TerraformStack): TerraformRemoteState {
    const key = fromStack.node.path;
    let remoteState = this._crossStackDataSources.get(key);
    if (remoteState === undefined) {
      const backend = fromStack.ensureBackendExists();
      remoteState = backend.getRemoteStateDataSource(this, `cross-stack-reference-${key}`, key);
      this._crossStackDataSources.set(key, remoteState);
    }
    return remoteState;
  }
}

class ValidateProviderPresence implements IValidation {
  constructor(private readonly stack: TerraformStack) {}

  validate(): string[] {
    const providers = this.stack.allProviders();
    if (providers.length === 0) {
      return [`Stack "${this.stack.stackName}" has no providers configured`];
    }
    return [];
  }
}
