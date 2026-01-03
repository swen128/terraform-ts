import { TerraformBackend } from "./backend.js";
import type { TerraformStack } from "../stack.js";

export type S3BackendConfig = {
  readonly bucket: string;
  readonly key: string;
  readonly region?: string;
  readonly encrypt?: boolean;
  readonly dynamodbTable?: string;
  readonly profile?: string;
  readonly roleArn?: string;
  readonly acl?: string;
};

export class S3Backend extends TerraformBackend {
  readonly bucket: string;
  readonly key: string;
  readonly region?: string;
  readonly encrypt?: boolean;
  readonly dynamodbTable?: string;
  readonly profile?: string;
  readonly roleArn?: string;
  readonly acl?: string;

  constructor(scope: TerraformStack, config: S3BackendConfig) {
    super(scope, "s3");

    this.bucket = config.bucket;
    this.key = config.key;
    this.region = config.region;
    this.encrypt = config.encrypt;
    this.dynamodbTable = config.dynamodbTable;
    this.profile = config.profile;
    this.roleArn = config.roleArn;
    this.acl = config.acl;
  }

  protected synthesizeAttributes(): Record<string, unknown> {
    const attrs: Record<string, unknown> = {
      bucket: this.bucket,
      key: this.key,
    };
    if (this.region !== undefined) attrs["region"] = this.region;
    if (this.encrypt !== undefined) attrs["encrypt"] = this.encrypt;
    if (this.dynamodbTable !== undefined) attrs["dynamodb_table"] = this.dynamodbTable;
    if (this.profile !== undefined) attrs["profile"] = this.profile;
    if (this.roleArn !== undefined) attrs["role_arn"] = this.roleArn;
    if (this.acl !== undefined) attrs["acl"] = this.acl;
    return attrs;
  }
}
