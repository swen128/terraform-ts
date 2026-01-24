import { z } from "zod";

export const TftsConfigSchema = z.object({
  language: z.enum(["typescript"]).default("typescript"),
  app: z.string(),
  output: z.string().default("cdktf.out"),
  codeMakerOutput: z.string().optional(),
  projectId: z.string().optional(),
  sendCrashReports: z.boolean().default(false),
  terraformProviders: z.array(z.string()).optional(),
  terraformModules: z.array(z.string()).optional(),
});

export type TftsConfig = z.infer<typeof TftsConfigSchema>;

export async function readConfig(configPath: string): Promise<TftsConfig> {
  const file = Bun.file(configPath);
  if (!(await file.exists())) {
    throw new Error(`Config file not found: ${configPath}`);
  }
  const content = await file.json();
  return TftsConfigSchema.parse(content);
}

export async function findConfig(cwd: string): Promise<string | null> {
  const configNames = ["cdktf.json", "tfts.json"];
  for (const name of configNames) {
    const configPath = `${cwd}/${name}`;
    const file = Bun.file(configPath);
    if (await file.exists()) {
      return configPath;
    }
  }
  return null;
}
