export type BackendDef = {
  readonly type: string;
  readonly config: Readonly<Record<string, unknown>>;
};
