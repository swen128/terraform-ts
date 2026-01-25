import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";

const coercedBoolean = z
  .union([z.boolean(), z.string()])
  .transform((val) => (typeof val === "boolean" ? val : val === "true"))
  .optional()
  .default(false);

export const TftsConfigSchema = z.object({
  language: z.enum(["typescript"]).default("typescript"),
  app: z.string(),
  output: z.string().default("cdktf.out"),
  codeMakerOutput: z.string().optional(),
  projectId: z.string().optional(),
  sendCrashReports: coercedBoolean,
  terraformProviders: z.array(z.string()).optional(),
  terraformModules: z.array(z.string()).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export type TftsConfig = z.infer<typeof TftsConfigSchema>;

export function readConfig(configPath: string): TftsConfig {
  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }
  const content: unknown = JSON.parse(readFileSync(configPath, "utf-8"));
  return TftsConfigSchema.parse(content);
}

export function findConfig(cwd: string): string | null {
  const configNames = ["cdktf.json", "tfts.json"];
  const found = configNames.map((name) => `${cwd}/${name}`).find((path) => existsSync(path));
  return found ?? null;
}
