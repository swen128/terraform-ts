import { TerraformBackend } from "./backend.js";
import type { TerraformStack } from "../stack.js";

export type LocalBackendConfig = {
  readonly path?: string;
  readonly workspaceDir?: string;
};

export class LocalBackend extends TerraformBackend {
  readonly statePath?: string;
  readonly workspaceDir?: string;

  constructor(scope: TerraformStack, config: LocalBackendConfig = {}) {
    super(scope, "local");

    this.statePath = config.path;
    this.workspaceDir = config.workspaceDir;
  }

  protected synthesizeAttributes(): Record<string, unknown> {
    const attrs: Record<string, unknown> = {};
    if (this.statePath !== undefined) attrs["path"] = this.statePath;
    if (this.workspaceDir !== undefined) attrs["workspace_dir"] = this.workspaceDir;
    return attrs;
  }
}
