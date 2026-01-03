import { ok, err, type Result } from "neverthrow";
import { z } from "zod";
import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";

const ProviderConstraintSchema = z.object({
  name: z.string(),
  source: z.string(),
  version: z.string().optional(),
});

const ModuleConstraintSchema = z.object({
  name: z.string(),
  source: z.string(),
  version: z.string().optional(),
});

const CdktfConfigSchema = z.object({
  language: z.literal("typescript"),
  app: z.string().min(1),
  output: z.string().min(1),
  terraformProviders: z.array(ProviderConstraintSchema).optional(),
  terraformModules: z.array(ModuleConstraintSchema).optional(),
  codeMakerOutput: z.string().optional(),
  projectId: z.string().optional(),
  sendCrashReports: z.boolean().optional(),
});

export type CdktfConfig = z.infer<typeof CdktfConfigSchema>;
export type ProviderConstraint = z.infer<typeof ProviderConstraintSchema>;
export type ModuleConstraint = z.infer<typeof ModuleConstraintSchema>;

export type ConfigError = {
  readonly field: string;
  readonly message: string;
};

export const readConfig = async (path: string): Promise<Result<CdktfConfig, ConfigError>> => {
  if (!existsSync(path)) {
    return err({ field: "path", message: `Config file not found: ${path}` });
  }

  const text = await fs.readFile(path, "utf-8");
  const parsed: unknown = JSON.parse(text);

  return parseConfig(parsed);
};

export const parseConfig = (parsed: unknown): Result<CdktfConfig, ConfigError> => {
  const result = CdktfConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    if (issue !== undefined) {
      return err({ field: issue.path.join(".") || "root", message: issue.message });
    }
    return err({ field: "root", message: "Invalid config" });
  }
  return ok(result.data);
};

export const parseProviderConstraint = (spec: string): ProviderConstraint => {
  const parts = spec.split("@");
  const sourceAndName = parts[0] ?? spec;
  const version = parts[1];

  const sourceParts = sourceAndName.split("/");
  const name = sourceParts[sourceParts.length - 1] ?? sourceAndName;

  return {
    name,
    source: sourceAndName,
    version,
  };
};

export const validateConfig = (config: unknown): readonly ConfigError[] => {
  const result = parseConfig(config);
  if (result.isErr()) {
    return [result.error];
  }
  return [];
};
