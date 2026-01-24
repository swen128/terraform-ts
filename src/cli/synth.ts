import { spawn } from "node:child_process";
import { findConfig, readConfig } from "./config.js";

export type SynthOptions = {
  app?: string;
  output?: string;
  cwd?: string;
};

export async function synth(options: SynthOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();

  const configPath = findConfig(cwd);
  if (configPath === null && options.app === undefined) {
    throw new Error(
      "No config file found and no app specified. Create cdktf.json or use --app flag.",
    );
  }

  const config = configPath !== null ? readConfig(configPath) : null;
  const appCommand = options.app ?? config?.app;
  const outputDir = options.output ?? config?.output ?? "cdktf.out";

  if (appCommand === undefined) {
    throw new Error("No app command specified");
  }

  console.log(`Synthesizing Terraform configuration...`);
  console.log(`  App: ${appCommand}`);
  console.log(`  Output: ${outputDir}`);

  const env = { ...process.env, CDKTF_OUTDIR: `${cwd}/${outputDir}` };

  const exitCode = await new Promise<number>((resolve, reject) => {
    const proc = spawn("sh", ["-c", appCommand], {
      cwd,
      env,
      stdio: "inherit",
    });
    proc.on("close", (code) => {
      resolve(code ?? 1);
    });
    proc.on("error", reject);
  });

  if (exitCode !== 0) {
    throw new Error(`App command failed with exit code ${String(exitCode)}`);
  }

  console.log(`\nSynthesis complete. Output written to ${outputDir}/`);
}
