import type { Construct } from "./construct.js";
import { TerraformElement } from "./terraform-element.js";
import type { TerraformRemoteState } from "./terraform-remote-state.js";

const BACKEND_SYMBOL = Symbol.for("tfts/TerraformBackend");

export abstract class TerraformBackend extends TerraformElement {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    Object.defineProperty(this, BACKEND_SYMBOL, { value: true });
  }

  static isBackend(x: unknown): x is TerraformBackend {
    return x !== null && typeof x === "object" && BACKEND_SYMBOL in x;
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
}

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
    return {
      terraform: {
        backend: {
          local: {
            ...(this.statePath ? { path: this.statePath } : {}),
            ...(this.workspaceDir ? { workspace_dir: this.workspaceDir } : {}),
          },
        },
      },
    };
  }

  protected override synthesizeAttributes(): Record<string, unknown> {
    return {
      ...(this.statePath ? { path: this.statePath } : {}),
      ...(this.workspaceDir ? { workspace_dir: this.workspaceDir } : {}),
    };
  }
}

import { DataTerraformRemoteStateLocal } from "./terraform-remote-state.js";
