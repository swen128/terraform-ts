import { createToken, ref } from "../core/tokens.js";
import type { Construct } from "./construct.js";
import { TerraformElement } from "./terraform-element.js";

const REMOTE_STATE_SYMBOL = Symbol.for("tfts/TerraformRemoteState");

export type TerraformRemoteStateConfig = {
  readonly backend: string;
  readonly config: Record<string, unknown>;
  readonly workspace?: string;
  readonly defaults?: Record<string, unknown>;
}

export abstract class TerraformRemoteState extends TerraformElement {
  protected readonly _backend: string;
  protected readonly _config: Record<string, unknown>;
  protected readonly _workspace?: string;
  protected readonly _defaults?: Record<string, unknown>;

  constructor(scope: Construct, id: string, backend: string, config: Record<string, unknown>) {
    super(scope, id, "data.terraform_remote_state");
    Object.defineProperty(this, REMOTE_STATE_SYMBOL, { value: true });

    this._backend = backend;
    this._config = config;
  }

  static isTerraformRemoteState(x: unknown): x is TerraformRemoteState {
    return x !== null && typeof x === "object" && REMOTE_STATE_SYMBOL in x;
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
    return {
      data: {
        terraform_remote_state: {
          [this.friendlyUniqueId]: {
            backend: this._backend,
            config: this._config,
            ...(this._workspace ? { workspace: this._workspace } : {}),
            ...(this._defaults ? { defaults: this._defaults } : {}),
          },
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
}

export class DataTerraformRemoteStateLocal extends TerraformRemoteState {
  constructor(scope: Construct, id: string, config: DataTerraformRemoteStateLocalConfig) {
    super(scope, id, "local", {
      ...(config.path ? { path: config.path } : {}),
      ...(config.workspaceDir ? { workspace_dir: config.workspaceDir } : {}),
    });
  }
}
