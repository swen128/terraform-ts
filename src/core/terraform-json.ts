export type TerraformJson = {
  readonly "//"?: TerraformMetadataBlock;
  readonly terraform?: TerraformBlock;
  readonly provider?: Record<string, readonly Record<string, unknown>[]>;
  readonly resource?: Record<string, Record<string, Record<string, unknown>>>;
  readonly data?: Record<string, Record<string, Record<string, unknown>>>;
  readonly variable?: Record<string, VariableBlock>;
  readonly output?: Record<string, OutputBlock>;
  readonly locals?: Record<string, unknown>;
  readonly module?: Record<string, ModuleBlock>;
  readonly moved?: readonly MovedBlock[];
  readonly import?: readonly ImportBlock[];
};

export type TerraformMetadataBlock = {
  readonly metadata?: {
    readonly version: string;
    readonly stackName: string;
    readonly backend: string;
    readonly cloud?: string;
    readonly overrides?: Record<string, readonly string[]>;
  };
  readonly outputs?: Record<string, unknown>;
};

export type TerraformBlock = {
  readonly required_providers?: Record<string, RequiredProvider>;
  readonly backend?: Record<string, Record<string, unknown>>;
  readonly cloud?: CloudBlock;
  readonly required_version?: string;
};

export type RequiredProvider = {
  readonly source: string;
  readonly version?: string;
};

export type CloudBlock = {
  readonly organization: string;
  readonly workspaces: CloudWorkspaceBlock;
  readonly hostname?: string;
  readonly token?: string;
};

export type CloudWorkspaceBlock = {
  readonly name?: string;
  readonly tags?: readonly string[];
  readonly project?: string;
};

export type VariableBlock = {
  readonly type?: string;
  readonly default?: unknown;
  readonly description?: string;
  readonly sensitive?: boolean;
  readonly nullable?: boolean;
  readonly validation?: readonly ValidationBlock[];
};

export type ValidationBlock = {
  readonly condition: string;
  readonly error_message: string;
};

export type OutputBlock = {
  readonly value: unknown;
  readonly description?: string;
  readonly sensitive?: boolean;
  readonly depends_on?: readonly string[];
  readonly precondition?: ConditionBlock;
};

export type ConditionBlock = {
  readonly condition: string;
  readonly error_message: string;
};

export type ModuleBlock = {
  readonly source: string;
  readonly version?: string;
  readonly providers?: Record<string, string>;
  readonly depends_on?: readonly string[];
  readonly for_each?: unknown;
  readonly count?: number | string;
  readonly [key: string]: unknown;
};

export type MovedBlock = {
  readonly from: string;
  readonly to: string;
};

export type ImportBlock = {
  readonly id: string;
  readonly to: string;
  readonly provider?: string;
};
