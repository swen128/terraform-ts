import { TerraformBackend } from "./backend.js";
import type { TerraformStack } from "../stack.js";

export type RemoteBackendConfig = {
  readonly hostname?: string;
  readonly organization: string;
  readonly token?: string;
  readonly workspaces: {
    readonly name?: string;
    readonly prefix?: string;
  };
};

export class RemoteBackend extends TerraformBackend {
  readonly hostname?: string;
  readonly organization: string;
  readonly token?: string;
  readonly workspaces: {
    readonly name?: string;
    readonly prefix?: string;
  };

  constructor(scope: TerraformStack, config: RemoteBackendConfig) {
    super(scope, "remote");

    this.hostname = config.hostname;
    this.organization = config.organization;
    this.token = config.token;
    this.workspaces = config.workspaces;
  }

  protected synthesizeAttributes(): Record<string, unknown> {
    const attrs: Record<string, unknown> = {
      organization: this.organization,
      workspaces: this.workspaces,
    };
    if (this.hostname !== undefined) attrs["hostname"] = this.hostname;
    if (this.token !== undefined) attrs["token"] = this.token;
    return attrs;
  }
}
