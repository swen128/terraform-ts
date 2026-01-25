export type ConstructNode = {
  readonly id: string;
  readonly path: readonly string[];
  readonly children: readonly ConstructNode[];
  readonly metadata: ConstructMetadata;
};

export type ConstructMetadata =
  | AppMetadata
  | StackMetadata
  | ResourceMetadata
  | ProviderMetadata
  | DataSourceMetadata
  | VariableMetadata
  | OutputMetadata
  | BackendMetadata
  | LocalMetadata
  | ModuleMetadata;

export type AppMetadata = {
  readonly kind: "app";
  readonly outdir: string;
  readonly skipValidation: boolean;
  readonly skipBackendValidation: boolean;
};

export type StackMetadata = {
  readonly kind: "stack";
  readonly stackName: string;
  readonly dependencies: readonly string[];
};

export type ResourceMetadata = {
  readonly kind: "resource";
  readonly resource: ResourceDef;
};

export type ProviderMetadata = {
  readonly kind: "provider";
  readonly provider: ProviderDef;
};

export type DataSourceMetadata = {
  readonly kind: "datasource";
  readonly datasource: DataSourceDef;
};

export type VariableMetadata = {
  readonly kind: "variable";
  readonly variable: VariableDef;
};

export type OutputMetadata = {
  readonly kind: "output";
  readonly output: OutputDef;
};

export type BackendMetadata = {
  readonly kind: "backend";
  readonly backend: BackendDef;
};

export type LocalMetadata = {
  readonly kind: "local";
  readonly local: LocalDef;
};

export type ModuleMetadata = {
  readonly kind: "module";
  readonly module: ModuleDef;
};

export type ResourceDef = {
  readonly terraformResourceType: string;
  readonly provider?: string;
  readonly dependsOn?: readonly string[];
  readonly count?: number | string;
  readonly forEach?: string;
  readonly lifecycle?: LifecycleDef;
  readonly provisioners?: readonly ProvisionerDef[];
  readonly connection?: ConnectionDef;
  readonly config: Record<string, unknown>;
  readonly overrides?: Record<string, unknown>;
};

export type ProviderDef = {
  readonly terraformProviderSource: string;
  readonly version?: string;
  readonly alias?: string;
  readonly config: Record<string, unknown>;
};

export type DataSourceDef = {
  readonly terraformResourceType: string;
  readonly provider?: string;
  readonly dependsOn?: readonly string[];
  readonly count?: number | string;
  readonly forEach?: string;
  readonly config: Record<string, unknown>;
};

export type VariableDef = {
  readonly type?: string;
  readonly default?: unknown;
  readonly description?: string;
  readonly sensitive?: boolean;
  readonly nullable?: boolean;
  readonly validation?: readonly ValidationDef[];
};

export type OutputDef = {
  readonly value: unknown;
  readonly description?: string;
  readonly sensitive?: boolean;
  readonly dependsOn?: readonly string[];
  readonly precondition?: ConditionDef;
};

export type BackendDef = {
  readonly type: string;
  readonly config: Record<string, unknown>;
};

export type LocalDef = {
  readonly expression: unknown;
};

export type ModuleDef = {
  readonly source: string;
  readonly version?: string;
  readonly providers?: Record<string, string>;
  readonly dependsOn?: readonly string[];
  readonly forEach?: string;
  readonly count?: number | string;
  readonly variables: Record<string, unknown>;
};

export type LifecycleDef = {
  readonly createBeforeDestroy?: boolean;
  readonly preventDestroy?: boolean;
  readonly ignoreChanges?: readonly string[] | "all";
  readonly replaceTriggeredBy?: readonly string[];
  readonly precondition?: readonly ConditionDef[];
  readonly postcondition?: readonly ConditionDef[];
};

export type ConditionDef = {
  readonly condition: string;
  readonly errorMessage: string;
};

export type ValidationDef = {
  readonly condition: string;
  readonly errorMessage: string;
};

export type ProvisionerDef = {
  readonly type: "local-exec" | "remote-exec" | "file";
  readonly config: Record<string, unknown>;
  readonly when?: "create" | "destroy";
  readonly onFailure?: "continue" | "fail";
  readonly connection?: ConnectionDef;
};

export type ConnectionDef = {
  readonly type?: "ssh" | "winrm";
  readonly user?: string;
  readonly password?: string;
  readonly host?: string;
  readonly port?: number;
  readonly timeout?: string;
  readonly scriptPath?: string;
  readonly privateKey?: string;
  readonly certificate?: string;
  readonly agent?: boolean;
  readonly agentIdentity?: string;
  readonly hostKey?: string;
  readonly targetPlatform?: "unix" | "windows";
  readonly bastion?: BastionConnectionDef;
  readonly https?: boolean;
  readonly insecure?: boolean;
  readonly useNtlm?: boolean;
  readonly cacert?: string;
};

export type BastionConnectionDef = {
  readonly host?: string;
  readonly hostKey?: string;
  readonly port?: number;
  readonly user?: string;
  readonly password?: string;
  readonly privateKey?: string;
  readonly certificate?: string;
};

export type ValidationError = {
  readonly path: readonly string[];
  readonly message: string;
  readonly level: "error" | "warning" | "info";
};
