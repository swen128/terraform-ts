import type { Construct } from "./construct.js";
import type { ElementKind } from "./terraform-element.js";
import { TerraformElement } from "./terraform-element.js";
import type { TerraformRemoteState } from "./terraform-remote-state.js";

export abstract class TerraformBackend extends TerraformElement {
  readonly kind: ElementKind = "backend";

  constructor(scope: Construct, id: string) {
    super(scope, id);
  }

  abstract getRemoteStateDataSource(
    scope: Construct,
    name: string,
    fromStack: string,
  ): TerraformRemoteState;

  protected synthesizeAttributes(): Record<string, unknown> {
    return {};
  }
}

export type LocalBackendConfig = {
  readonly path?: string;
  readonly workspaceDir?: string;
};

export class LocalBackend extends TerraformBackend {
  private readonly statePath?: string;
  private readonly workspaceDir?: string;

  constructor(scope: Construct, config: LocalBackendConfig) {
    super(scope, "backend");
    this.statePath = config.path;
    this.workspaceDir = config.workspaceDir;
  }

  override getRemoteStateDataSource(
    scope: Construct,
    name: string,
    _fromStack: string,
  ): TerraformRemoteState {
    return new DataTerraformRemoteStateLocal(scope, name, {
      path: this.statePath,
      workspaceDir: this.workspaceDir,
    });
  }

  override toTerraform(): Record<string, unknown> {
    const config: Record<string, unknown> = {};
    if (this.statePath !== undefined && this.statePath !== "") {
      config["path"] = this.statePath;
    }
    if (this.workspaceDir !== undefined && this.workspaceDir !== "") {
      config["workspace_dir"] = this.workspaceDir;
    }
    return {
      terraform: {
        backend: {
          local: config,
        },
      },
    };
  }

  protected override synthesizeAttributes(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    if (this.statePath !== undefined && this.statePath !== "") {
      result["path"] = this.statePath;
    }
    if (this.workspaceDir !== undefined && this.workspaceDir !== "") {
      result["workspace_dir"] = this.workspaceDir;
    }
    return result;
  }
}

import { DataTerraformRemoteStateLocal } from "./terraform-remote-state.js";
