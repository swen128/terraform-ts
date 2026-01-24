import type { Construct } from "../construct.js";
import { TerraformBackend } from "../terraform-backend.js";
import { TerraformRemoteState } from "../terraform-remote-state.js";
import { keysToSnakeCase } from "../util.js";
import { DataTerraformRemoteStateRemote } from "./remote-backend.js";

export function getHostNameType(hostname?: string): "tfc" | "tfe" {
  if (hostname === undefined || hostname === "") return "tfc";
  return hostname.startsWith("app.terraform.io") ? "tfc" : "tfe";
}

export class CloudBackend extends TerraformBackend {
  constructor(
    scope: Construct,
    private readonly props: CloudBackendConfig,
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
    if (this.props.workspaces instanceof NamedCloudWorkspace) {
      return new DataTerraformRemoteStateRemote(scope, name, {
        organization: this.props.organization,
        workspaces: { name: this.props.workspaces.name },
        token: this.props.token,
        hostname: this.props.hostname,
      });
    }
    throw new Error(
      "The cloud backend does not support cross-stack references when using tagged workspaces. Please use named workspaces instead.",
    );
  }

  override toTerraform(): Record<string, unknown> {
    return {
      terraform: {
        cloud: {
          ...keysToSnakeCase({
            organization: this.props.organization,
            hostname: this.props.hostname,
            token: this.props.token,
          }),
          workspaces: this.props.workspaces.toTerraform(),
        },
      },
    };
  }

  protected override synthesizeAttributes(): Record<string, unknown> {
    return keysToSnakeCase({
      ...this.props,
      workspaces: this.props.workspaces.toTerraform(),
    });
  }
}

export type CloudBackendConfig = {
  readonly organization: string;
  readonly workspaces: NamedCloudWorkspace | TaggedCloudWorkspaces;
  readonly hostname?: string;
  readonly token?: string;
};

export abstract class CloudWorkspace {
  abstract toTerraform(): Record<string, unknown>;
}

export class NamedCloudWorkspace extends CloudWorkspace {
  constructor(
    public readonly name: string,
    public readonly project?: string,
  ) {
    super();
  }

  toTerraform(): Record<string, unknown> {
    return {
      name: this.name,
      ...(this.project !== undefined && this.project !== "" ? { project: this.project } : {}),
    };
  }
}

export class TaggedCloudWorkspaces extends CloudWorkspace {
  constructor(
    public readonly tags: string[],
    public readonly project?: string,
  ) {
    super();
  }

  toTerraform(): Record<string, unknown> {
    return {
      tags: this.tags,
      ...(this.project !== undefined && this.project !== "" ? { project: this.project } : {}),
    };
  }
}
