import { TerraformBackend } from "./backend.js";
import type { TerraformStack } from "../stack.js";

export type GcsBackendConfig = {
  readonly bucket: string;
  readonly prefix?: string;
  readonly credentials?: string;
  readonly impersonateServiceAccount?: string;
  readonly accessToken?: string;
};

export class GcsBackend extends TerraformBackend {
  readonly bucket: string;
  readonly prefix?: string;
  readonly credentials?: string;
  readonly impersonateServiceAccount?: string;
  readonly accessToken?: string;

  constructor(scope: TerraformStack, config: GcsBackendConfig) {
    super(scope, "gcs");

    this.bucket = config.bucket;
    this.prefix = config.prefix;
    this.credentials = config.credentials;
    this.impersonateServiceAccount = config.impersonateServiceAccount;
    this.accessToken = config.accessToken;
  }

  protected synthesizeAttributes(): Record<string, unknown> {
    const attrs: Record<string, unknown> = {
      bucket: this.bucket,
    };
    if (this.prefix !== undefined) attrs["prefix"] = this.prefix;
    if (this.credentials !== undefined) attrs["credentials"] = this.credentials;
    if (this.impersonateServiceAccount !== undefined)
      attrs["impersonate_service_account"] = this.impersonateServiceAccount;
    if (this.accessToken !== undefined) attrs["access_token"] = this.accessToken;
    return attrs;
  }
}
