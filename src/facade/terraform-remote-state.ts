import { createToken, ref } from "../core/tokens.js";
import type { Construct } from "./construct.js";
import type { ElementKind } from "./terraform-element.js";
import { TerraformElement } from "./terraform-element.js";

export type TerraformRemoteStateConfig = {
  readonly backend: string;
  readonly config: Record<string, unknown>;
  readonly workspace?: string;
  readonly defaults?: Record<string, unknown>;
};

export abstract class TerraformRemoteState extends TerraformElement {
  readonly kind: ElementKind = "remote-state";

  protected readonly _backend: string;
  protected readonly _config: Record<string, unknown>;
  protected readonly _workspace?: string;
  protected readonly _defaults?: Record<string, unknown>;

  constructor(scope: Construct, id: string, backend: string, config: Record<string, unknown>) {
    super(scope, id, "data.terraform_remote_state");

    this._backend = backend;
    this._config = config;
  }

  get(output: string): string {
    const token = ref(`data.terraform_remote_state.${this.friendlyUniqueId}`, `outputs.${output}`);
    return createToken(token);
  }

  getString(output: string): string {
    return this.get(output);
  }

  getNumber(output: string): number {
    return Number(this.get(output));
  }

  getList(output: string): string[] {
    return [this.get(output)];
  }

  getBoolean(output: string): boolean {
    return Boolean(this.get(output));
  }

  override toTerraform(): Record<string, unknown> {
    const config: Record<string, unknown> = {
      backend: this._backend,
      config: this._config,
    };
    if (this._workspace !== undefined && this._workspace !== "") {
      config["workspace"] = this._workspace;
    }
    if (this._defaults !== undefined) {
      config["defaults"] = this._defaults;
    }
    return {
      data: {
        terraform_remote_state: {
          [this.friendlyUniqueId]: config,
        },
      },
    };
  }
}

export type DataTerraformRemoteStateLocalConfig = {
  readonly path?: string;
  readonly workspaceDir?: string;
  readonly workspace?: string;
  readonly defaults?: Record<string, unknown>;
};

export class DataTerraformRemoteStateLocal extends TerraformRemoteState {
  constructor(scope: Construct, id: string, config: DataTerraformRemoteStateLocalConfig) {
    const backendConfig: Record<string, unknown> = {};
    if (config.path !== undefined && config.path !== "") {
      backendConfig["path"] = config.path;
    }
    if (config.workspaceDir !== undefined && config.workspaceDir !== "") {
      backendConfig["workspace_dir"] = config.workspaceDir;
    }
    super(scope, id, "local", backendConfig);
  }
}
