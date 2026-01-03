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
    const attrs: Record<string, unknown> = {};
    if (config.path !== undefined) attrs["path"] = config.path;
    if (config.workspaceDir !== undefined) attrs["workspace_dir"] = config.workspaceDir;

    super(scope, "local", attrs);

    this.statePath = config.path;
    this.workspaceDir = config.workspaceDir;
  }
}
