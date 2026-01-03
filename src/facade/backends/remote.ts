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
    const attrs: Record<string, unknown> = {
      organization: config.organization,
      workspaces: config.workspaces,
    };
    if (config.hostname !== undefined) attrs["hostname"] = config.hostname;
    if (config.token !== undefined) attrs["token"] = config.token;

    super(scope, "remote", attrs);

    this.hostname = config.hostname;
    this.organization = config.organization;
    this.token = config.token;
    this.workspaces = config.workspaces;
  }
}
