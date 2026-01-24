import type { Construct } from "../construct.js";
import { TerraformBackend } from "../terraform-backend.js";
import { TerraformRemoteState } from "../terraform-remote-state.js";
import { keysToSnakeCase } from "../util.js";
import { getHostNameType } from "./cloud-backend.js";

export class RemoteBackend extends TerraformBackend {
  constructor(
    scope: Construct,
    private readonly props: RemoteBackendConfig,
  ) {
    super(scope, "backend");
  }

  override toMetadata(): Record<string, unknown> {
    const cloud = getHostNameType(this.props.hostname);
    return { cloud };
  }

  override getRemoteStateDataSource(
    scope: Construct,
    name: string,
    _fromStack: string,
  ): TerraformRemoteState {
    return new DataTerraformRemoteStateRemote(scope, name, {
      ...this.props,
    });
  }

  override toTerraform(): Record<string, unknown> {
    return {
      terraform: {
        backend: {
          remote: keysToSnakeCase({ ...this.props }),
        },
      },
    };
  }

  protected override synthesizeAttributes(): Record<string, unknown> {
    return keysToSnakeCase({ ...this.props });
  }
}

export class DataTerraformRemoteStateRemote extends TerraformRemoteState {
  constructor(scope: Construct, id: string, config: DataTerraformRemoteStateRemoteConfig) {
    super(scope, id, "remote", keysToSnakeCase(config));
  }
}

export type IRemoteWorkspace = {};

export class NamedRemoteWorkspace implements IRemoteWorkspace {
  constructor(public readonly name: string) {}
}

export class PrefixedRemoteWorkspaces implements IRemoteWorkspace {
  constructor(public readonly prefix: string) {}
}

export type RemoteBackendConfig = {
  readonly hostname?: string;
  readonly organization: string;
  readonly token?: string;
  readonly workspaces: IRemoteWorkspace;
};

export type DataTerraformRemoteStateRemoteConfig = RemoteBackendConfig & {
  readonly workspace?: string;
  readonly defaults?: Record<string, unknown>;
};
