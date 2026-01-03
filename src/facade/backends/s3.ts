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
    const attrs: Record<string, unknown> = {
      bucket: config.bucket,
      key: config.key,
    };
    if (config.region !== undefined) attrs["region"] = config.region;
    if (config.encrypt !== undefined) attrs["encrypt"] = config.encrypt;
    if (config.dynamodbTable !== undefined) attrs["dynamodb_table"] = config.dynamodbTable;
    if (config.profile !== undefined) attrs["profile"] = config.profile;
    if (config.roleArn !== undefined) attrs["role_arn"] = config.roleArn;
    if (config.acl !== undefined) attrs["acl"] = config.acl;

    super(scope, "s3", attrs);

    this.bucket = config.bucket;
    this.key = config.key;
    this.region = config.region;
    this.encrypt = config.encrypt;
    this.dynamodbTable = config.dynamodbTable;
    this.profile = config.profile;
    this.roleArn = config.roleArn;
    this.acl = config.acl;
  }
}
