import type { Construct } from "../construct.js";
import { TerraformBackend } from "../terraform-backend.js";
import { TerraformRemoteState } from "../terraform-remote-state.js";
import { keysToSnakeCase } from "../util.js";

export class GcsBackend extends TerraformBackend {
  constructor(
    scope: Construct,
    private readonly props: GcsBackendConfig,
  ) {
    super(scope, "backend");
  }

  override getRemoteStateDataSource(
    scope: Construct,
    name: string,
    _fromStack: string,
  ): TerraformRemoteState {
    return new DataTerraformRemoteStateGcs(scope, name, {
      ...this.props,
      workspace: "${terraform.workspace}",
    });
  }

  override toTerraform(): Record<string, unknown> {
    return {
      terraform: {
        backend: {
          gcs: keysToSnakeCase({ ...this.props }),
        },
      },
    };
  }

  protected override synthesizeAttributes(): Record<string, unknown> {
    return keysToSnakeCase({ ...this.props });
  }
}

export class DataTerraformRemoteStateGcs extends TerraformRemoteState {
  constructor(scope: Construct, id: string, config: DataTerraformRemoteStateGcsConfig) {
    super(scope, id, "gcs", keysToSnakeCase(config));
  }
}

export type GcsBackendConfig = {
  readonly bucket: string;
  readonly credentials?: string;
  readonly accessToken?: string;
  readonly prefix?: string;
  readonly encryptionKey?: string;
  readonly impersonateServiceAccount?: string;
  readonly impersonateServiceAccountDelegates?: string[];
  readonly kmsEncryptionKey?: string;
  readonly storageCustomEndpoint?: string;
};

export type DataTerraformRemoteStateGcsConfig = GcsBackendConfig & {
  readonly workspace?: string;
  readonly defaults?: Record<string, unknown>;
};
