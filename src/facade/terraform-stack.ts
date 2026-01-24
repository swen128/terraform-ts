import { generateLogicalId } from "../core/synthesize.js";
import type { TerraformJson } from "../core/terraform-json.js";
import { resolveTokens, type Token, tokenToString } from "../core/tokens.js";
import { App } from "./app.js";
import { Construct, type IValidation } from "./construct.js";
import { deepMerge } from "./util.js";

const STACK_SYMBOL = Symbol.for("tfts/TerraformStack");

export interface TerraformStackMetadata {
  readonly stackName: string;
  readonly version: string;
  readonly backend: string;
}

export class TerraformStack extends Construct {
  public dependencies: TerraformStack[] = [];
  private readonly _crossStackOutputs: Map<string, TerraformOutput> = new Map();
  private readonly _crossStackDataSources: Map<string, TerraformRemoteState> = new Map();

  constructor(scope: Construct, id: string) {
    super(scope, id);
    Object.defineProperty(this, STACK_SYMBOL, { value: true });

    this.node.addValidation(new ValidateProviderPresence(this));
  }

  static isStack(x: unknown): x is TerraformStack {
    return x !== null && typeof x === "object" && STACK_SYMBOL in x;
  }

  static of(construct: Construct): TerraformStack {
    let current: Construct | undefined = construct;
    while (current) {
      if (TerraformStack.isStack(current)) {
        return current;
      }
      current = current._scope;
    }
    throw new Error(`No TerraformStack found in scope of ${construct.node.path}`);
  }

  get stackName(): string {
    return this.node.id;
  }

  prepareStack(): void {
    this.ensureBackendExists();
  }

  synthesize(): void {
    const app = App.of(this);
    const stackDir = `${app.outdir}/stacks/${this.stackName}`;

    const fs = require("fs");
    const path = require("path");

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

  toTerraform(): TerraformJson {
    const elements = this.node.findAll().filter((c) => c !== this && isTerraformElement(c));

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
      const fragment = (element as unknown as TerraformElement).toTerraform();
      result = deepMerge(result, fragment);
    }

    return resolveTokens(result, (token: Token) => tokenToString(token)) as TerraformJson;
  }

  getLogicalId(element: { node: { path: string } }): string {
    const pathParts = element.node.path.split("/");
    return generateLogicalId(pathParts);
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
    const backends = this.node
      .findAll()
      .filter((c): c is TerraformBackend => TerraformBackend.isBackend(c));
    if (backends.length > 0 && backends[0]) {
      return backends[0];
    }
    return new LocalBackend(this, {});
  }

  allProviders(): TerraformProvider[] {
    return this.node
      .findAll()
      .filter((c): c is TerraformProvider => TerraformProvider.isTerraformProvider(c));
  }

  registerOutgoingCrossStackReference(identifier: string): string {
    let output = this._crossStackOutputs.get(identifier);
    if (!output) {
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
    if (!remoteState) {
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

import { LocalBackend, TerraformBackend } from "./terraform-backend.js";
import { TerraformElement } from "./terraform-element.js";
import { TerraformOutput } from "./terraform-output.js";
import { TerraformProvider } from "./terraform-provider.js";
import { TerraformRemoteState } from "./terraform-remote-state.js";

function isTerraformElement(x: unknown): x is TerraformElement {
  return TerraformElement.isTerraformElement(x);
}
