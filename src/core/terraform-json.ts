export type TerraformJson = {
  readonly terraform?: TerraformBlock;
  readonly provider?: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>;
  readonly resource?: Readonly<
    Record<string, Readonly<Record<string, Readonly<Record<string, unknown>>>>>
  >;
  readonly data?: Readonly<
    Record<string, Readonly<Record<string, Readonly<Record<string, unknown>>>>>
  >;
  readonly variable?: Readonly<Record<string, VariableBlock>>;
  readonly output?: Readonly<Record<string, OutputBlock>>;
  readonly locals?: Readonly<Record<string, unknown>>;
};

export type TerraformBlock = {
  readonly required_providers?: Readonly<Record<string, RequiredProvider>>;
  readonly backend?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly required_version?: string;
};

export type RequiredProvider = {
  readonly source: string;
  readonly version?: string;
};

export type VariableBlock = {
  readonly type?: string;
  readonly default?: unknown;
  readonly description?: string;
  readonly sensitive?: boolean;
  readonly nullable?: boolean;
  readonly validation?: readonly {
    readonly condition: string;
    readonly error_message: string;
  }[];
};

export type OutputBlock = {
  readonly value: unknown;
  readonly description?: string;
  readonly sensitive?: boolean;
  readonly depends_on?: readonly string[];
};
