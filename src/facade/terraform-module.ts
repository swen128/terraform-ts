import { createToken, ref } from "../core/tokens.js";
import type { Construct } from "./construct.js";
import type { ElementKind } from "./terraform-element.js";
import { TerraformElement } from "./terraform-element.js";
import { TerraformProvider } from "./terraform-provider.js";
import { deepMerge } from "./util.js";

export type TerraformModuleProvider = {
  readonly provider: TerraformProvider;
  readonly moduleAlias: string;
};

export type TerraformModuleConfig = {
  readonly source: string;
  readonly version?: string;
  readonly providers?: (TerraformProvider | TerraformModuleProvider)[];
  readonly dependsOn?: string[];
  readonly forEach?: unknown;
  readonly skipAssetCreationFromLocalModules?: boolean;
};

export abstract class TerraformModule extends TerraformElement {
  readonly kind: ElementKind = "module";

  readonly source: string;
  readonly version?: string;
  private _providers?: (TerraformProvider | TerraformModuleProvider)[];
  dependsOn?: string[];
  forEach?: unknown;
  readonly skipAssetCreationFromLocalModules?: boolean;

  constructor(scope: Construct, id: string, options: TerraformModuleConfig) {
    super(scope, id, "module");

    this.source = options.source;
    this.version = options.version;
    this._providers = options.providers;
    this.dependsOn = options.dependsOn;
    this.forEach = options.forEach;
    this.skipAssetCreationFromLocalModules = options.skipAssetCreationFromLocalModules;
  }

  get providers(): (TerraformProvider | TerraformModuleProvider)[] | undefined {
    return this._providers;
  }

  addProvider(provider: TerraformProvider | TerraformModuleProvider): void {
    if (this._providers === undefined) {
      this._providers = [];
    }
    this._providers.push(provider);
  }

  interpolationForOutput(moduleOutput: string): string {
    const suffix = this.forEach !== undefined ? ".*" : "";
    const token = ref(`module.${this.friendlyUniqueId}${suffix}`, moduleOutput);
    return createToken(token);
  }

  getString(output: string): string {
    return this.interpolationForOutput(output);
  }

  protected synthesizeAttributes(): Record<string, unknown> {
    return {};
  }

  private synthesizeProviders(): Record<string, string> | undefined {
    if (this._providers === undefined || this._providers.length === 0) {
      return undefined;
    }
    const result: Record<string, string> = {};
    for (const p of this._providers) {
      if (p instanceof TerraformProvider) {
        result[p.terraformResourceType] = p.fqn;
      } else {
        const key = `${p.provider.terraformResourceType}.${p.moduleAlias}`;
        result[key] = p.provider.fqn;
      }
    }
    return result;
  }

  override toTerraform(): Record<string, unknown> {
    const base: Record<string, unknown> = {
      ...this.synthesizeAttributes(),
      source: this.source,
    };
    if (this.version !== undefined && this.version !== "") {
      base["version"] = this.version;
    }
    const providers = this.synthesizeProviders();
    if (providers !== undefined) {
      base["providers"] = providers;
    }
    if (this.dependsOn !== undefined && this.dependsOn.length > 0) {
      base["depends_on"] = this.dependsOn;
    }
    if (this.forEach !== undefined) {
      base["for_each"] = this.forEach;
    }

    const attributes = deepMerge(base, this.rawOverrides);

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
