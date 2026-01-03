export type ProviderDef = {
  readonly terraformProviderSource: string;
  readonly version?: string;
  readonly alias?: string;
  readonly config: Readonly<Record<string, unknown>>;
};
