import type { Construct } from "../construct.js";
import { TerraformBackend } from "../terraform-backend.js";
import { TerraformRemoteState } from "../terraform-remote-state.js";
import { keysToSnakeCase } from "../util.js";

export class S3Backend extends TerraformBackend {
  constructor(
    scope: Construct,
    private readonly props: S3BackendConfig,
  ) {
    super(scope, "backend");
  }

  override getRemoteStateDataSource(
    scope: Construct,
    name: string,
    _fromStack: string,
  ): TerraformRemoteState {
    return new DataTerraformRemoteStateS3(scope, name, {
      ...this.props,
      workspace: "${terraform.workspace}",
    });
  }

  override toTerraform(): Record<string, unknown> {
    return {
      terraform: {
        backend: {
          s3: keysToSnakeCase({ ...this.props }),
        },
      },
    };
  }

  protected override synthesizeAttributes(): Record<string, unknown> {
    return keysToSnakeCase({ ...this.props });
  }
}

export class DataTerraformRemoteStateS3 extends TerraformRemoteState {
  constructor(scope: Construct, id: string, config: DataTerraformRemoteStateS3Config) {
    super(scope, id, "s3", keysToSnakeCase(config));
  }
}

export interface S3BackendConfig {
  readonly bucket: string;
  readonly key: string;
  readonly region?: string;
  readonly endpoint?: string;
  readonly encrypt?: boolean;
  readonly acl?: string;
  readonly accessKey?: string;
  readonly secretKey?: string;
  readonly kmsKeyId?: string;
  readonly dynamodbTable?: string;
  readonly profile?: string;
  readonly sharedCredentialsFile?: string;
  readonly sharedCredentialsFiles?: string[];
  readonly sharedConfigFiles?: string[];
  readonly token?: string;
  readonly roleArn?: string;
  readonly assumeRolePolicy?: string;
  readonly assumeRolePolicyArns?: string[];
  readonly assumeRoleTags?: Record<string, string>;
  readonly assumeRoleTransitiveTagKeys?: string[];
  readonly externalId?: string;
  readonly sessionName?: string;
  readonly workspaceKeyPrefix?: string;
  readonly dynamodbEndpoint?: string;
  readonly iamEndpoint?: string;
  readonly stsEndpoint?: string;
  readonly stsRegion?: string;
  readonly forcePathStyle?: boolean;
  readonly usePathStyle?: boolean;
  readonly skipCredentialsValidation?: boolean;
  readonly skipRegionValidation?: boolean;
  readonly skipRequestingAccountId?: boolean;
  readonly skipMetadataApiCheck?: boolean;
  readonly skipS3Checksum?: boolean;
  readonly sseCustomerKey?: string;
  readonly maxRetries?: number;
  readonly useLegacyWorkflow?: boolean;
  readonly allowedAccountIds?: string[];
  readonly forbiddenAccountIds?: string[];
  readonly customCaBundle?: string;
  readonly ec2MetadataServiceEndpoint?: string;
  readonly ec2MetadataServiceEndpointMode?: string;
  readonly httpProxy?: string;
  readonly httpsProxy?: string;
  readonly insecure?: boolean;
  readonly noProxy?: string;
  readonly retryMode?: string;
  readonly endpoints?: S3BackendEndpointConfig;
  readonly assumeRole?: S3BackendAssumeRoleConfig;
  readonly assumeRoleWithWebIdentity?: S3BackendAssumeRoleWithWebIdentityConfig;
}

export interface S3BackendEndpointConfig {
  readonly dynamodb?: string;
  readonly iam?: string;
  readonly s3?: string;
  readonly sso?: string;
  readonly sts?: string;
}

export interface S3BackendAssumeRoleConfig {
  readonly roleArn: string;
  readonly duration?: string;
  readonly externalId?: string;
  readonly policy?: string;
  readonly policyArns?: string[];
  readonly sessionName?: string;
  readonly sourceIdentity?: string;
  readonly tags?: Record<string, string>;
  readonly transitiveTagKeys?: string[];
}

export interface S3BackendAssumeRoleWithWebIdentityConfig {
  readonly roleArn?: string;
  readonly duration?: string;
  readonly policy?: string;
  readonly policyArns?: string[];
  readonly sessionName?: string;
  readonly webIdentityToken?: string;
  readonly webIdentityTokenFile?: string;
}

export interface DataTerraformRemoteStateS3Config extends S3BackendConfig {
  readonly workspace?: string;
  readonly defaults?: Record<string, unknown>;
}
