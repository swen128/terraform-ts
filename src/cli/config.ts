export type CdktfConfig = {
  readonly language: "typescript";
  readonly app: string;
  readonly output: string;
  readonly terraformProviders?: readonly ProviderConstraint[];
  readonly terraformModules?: readonly ModuleConstraint[];
  readonly codeMakerOutput?: string;
  readonly projectId?: string;
  readonly sendCrashReports?: boolean;
};

export type ProviderConstraint = {
  readonly name: string;
  readonly source: string;
  readonly version?: string;
};

export type ModuleConstraint = {
  readonly name: string;
  readonly source: string;
  readonly version?: string;
};
