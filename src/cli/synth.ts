import { findConfig, readConfig } from "./config.js";

export interface SynthOptions {
  app?: string;
  output?: string;
  cwd?: string;
}

export async function synth(options: SynthOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();

  const configPath = await findConfig(cwd);
  if (!configPath && !options.app) {
    throw new Error(
      "No config file found and no app specified. Create cdktf.json or use --app flag.",
    );
  }

  const config = configPath ? await readConfig(configPath) : null;
  const appCommand = options.app ?? config?.app;
  const outputDir = options.output ?? config?.output ?? "cdktf.out";

  if (!appCommand) {
    throw new Error("No app command specified");
  }

  console.log(`Synthesizing Terraform configuration...`);
  console.log(`  App: ${appCommand}`);
  console.log(`  Output: ${outputDir}`);

  const env = { ...process.env, CDKTF_OUTDIR: `${cwd}/${outputDir}` };

  const proc = Bun.spawn(["sh", "-c", appCommand], {
    cwd,
    env,
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(`App command failed with exit code ${exitCode}`);
  }

  console.log(`\nSynthesis complete. Output written to ${outputDir}/`);
}
