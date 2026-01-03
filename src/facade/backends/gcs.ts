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
    const attrs: Record<string, unknown> = {
      bucket: config.bucket,
    };
    if (config.prefix !== undefined) attrs["prefix"] = config.prefix;
    if (config.credentials !== undefined) attrs["credentials"] = config.credentials;
    if (config.impersonateServiceAccount !== undefined)
      attrs["impersonate_service_account"] = config.impersonateServiceAccount;
    if (config.accessToken !== undefined) attrs["access_token"] = config.accessToken;

    super(scope, "gcs", attrs);

    this.bucket = config.bucket;
    this.prefix = config.prefix;
    this.credentials = config.credentials;
    this.impersonateServiceAccount = config.impersonateServiceAccount;
    this.accessToken = config.accessToken;
  }
}
