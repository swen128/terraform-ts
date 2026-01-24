import { createToken, ref } from "../core/tokens.js";
import type { Construct } from "./construct.js";
import { TerraformElement } from "./terraform-element.js";
import type { TerraformProvider } from "./terraform-provider.js";
import { deepMerge } from "./util.js";

const MODULE_SYMBOL = Symbol.for("tfts/TerraformModule");

export type TerraformModuleProvider = {
  readonly provider: TerraformProvider;
  readonly moduleAlias: string;
}

export type TerraformModuleConfig = {
  readonly source: string;
  readonly version?: string;
  readonly providers?: (TerraformProvider | TerraformModuleProvider)[];
  readonly dependsOn?: string[];
  readonly forEach?: unknown;
  readonly skipAssetCreationFromLocalModules?: boolean;
}

export abstract class TerraformModule extends TerraformElement {
  readonly source: string;
  readonly version?: string;
  private _providers?: (TerraformProvider | TerraformModuleProvider)[];
  dependsOn?: string[];
  forEach?: unknown;
  readonly skipAssetCreationFromLocalModules?: boolean;

  constructor(scope: Construct, id: string, options: TerraformModuleConfig) {
    super(scope, id, "module");
    Object.defineProperty(this, MODULE_SYMBOL, { value: true });

    this.source = options.source;
    this.version = options.version;
    this._providers = options.providers;
    this.dependsOn = options.dependsOn;
    this.forEach = options.forEach;
    this.skipAssetCreationFromLocalModules = options.skipAssetCreationFromLocalModules;
  }

  static isTerraformModule(x: unknown): x is TerraformModule {
    return x !== null && typeof x === "object" && MODULE_SYMBOL in x;
  }

  get providers(): (TerraformProvider | TerraformModuleProvider)[] | undefined {
    return this._providers;
  }

  addProvider(provider: TerraformProvider | TerraformModuleProvider): void {
    if (!this._providers) {
      this._providers = [];
    }
    this._providers.push(provider);
  }

  interpolationForOutput(moduleOutput: string): string {
    const suffix = this.forEach ? ".*" : "";
    const token = ref(`module.${this.friendlyUniqueId}${suffix}`, moduleOutput);
    return createToken(token);
  }

  getString(output: string): string {
    return this.interpolationForOutput(output);
  }

  getNumber(output: string): number {
    return Number(this.interpolationForOutput(output));
  }

  getList(output: string): string[] {
    return [this.interpolationForOutput(output)];
  }

  getBoolean(output: string): boolean {
    return Boolean(this.interpolationForOutput(output));
  }

  protected synthesizeAttributes(): Record<string, unknown> {
    return {};
  }

  private synthesizeProviders(): Record<string, string> | undefined {
    if (!this._providers || this._providers.length === 0) {
      return undefined;
    }
    return this._providers.reduce(
      (acc, p) => {
        if ("moduleAlias" in p) {
          const key = `${p.provider.terraformResourceType}.${p.moduleAlias}`;
          acc[key] = p.provider.fqn;
        } else {
          acc[p.terraformResourceType] = p.fqn;
        }
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  override toTerraform(): Record<string, unknown> {
    const attributes = deepMerge(
      {
        ...this.synthesizeAttributes(),
        source: this.source,
        version: this.version,
        providers: this.synthesizeProviders(),
        depends_on: this.dependsOn,
        for_each: this.forEach,
      },
      this.rawOverrides,
    );

    return {
      module: {
        [this.friendlyUniqueId]: attributes,
      },
    };
  }

  override toMetadata(): Record<string, unknown> {
    if (Object.keys(this.rawOverrides).length === 0) {
      return {};
    }
    return {
      overrides: {
        [`module.${this.source}`]: Object.keys(this.rawOverrides),
      },
    };
  }
}
