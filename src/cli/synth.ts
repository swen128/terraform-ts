import { ok, err, type Result } from "neverthrow";
import * as fs from "node:fs/promises";
import { spawn } from "node:child_process";
import type { TerraformJson } from "../core/terraform-json.js";
import { readConfig, type ConfigError } from "./config.js";

export type SynthOptions = {
  readonly configPath?: string;
  readonly output?: string;
  readonly app?: string;
};

export type SynthError =
  | { readonly kind: "config"; readonly error: ConfigError }
  | { readonly kind: "exec"; readonly message: string }
  | { readonly kind: "io"; readonly message: string };

export type Manifest = {
  readonly version: string;
  readonly stacks: Record<string, ManifestStack>;
};

export type ManifestStack = {
  readonly name: string;
  readonly synthesizedStackPath: string;
  readonly workingDirectory: string;
};

export const runSynth = async (options: SynthOptions): Promise<Result<void, SynthError>> => {
  const configPath = options.configPath ?? "cdktf.json";
  const configResult = await readConfig(configPath);

  if (configResult.isErr()) {
    return err({ kind: "config", error: configResult.error });
  }

  const config = configResult.value;
  const appCommand = options.app ?? config.app;
  const outdir = options.output ?? config.output;

  const execResult = await executeApp(appCommand, outdir);
  if (execResult.isErr()) {
    return execResult;
  }

  return ok(undefined);
};

export const executeApp = async (
  command: string,
  outdir: string,
): Promise<Result<void, SynthError>> => {
  const exitCode = await new Promise<number>((resolve) => {
    const proc = spawn("sh", ["-c", command], {
      env: { ...process.env, CDKTF_OUTDIR: outdir },
      stdio: "inherit",
    });
    proc.on("close", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    return err({ kind: "exec", message: `App command failed with exit code ${exitCode}` });
  }

  return ok(undefined);
};

export const writeOutput = async (
  stackName: string,
  json: TerraformJson,
  outdir: string,
): Promise<Result<void, SynthError>> => {
  const stackDir = `${outdir}/stacks/${stackName}`;
  await fs.mkdir(stackDir, { recursive: true });

  const outputPath = `${stackDir}/cdk.tf.json`;
  await fs.writeFile(outputPath, JSON.stringify(json, null, 2));

  return ok(undefined);
};

export const writeManifest = async (
  stacks: ReadonlyMap<string, TerraformJson>,
  outdir: string,
): Promise<Result<void, SynthError>> => {
  const manifest: Manifest = {
    version: "1.0.0",
    stacks: Object.fromEntries(
      Array.from(stacks.keys()).map((name) => [
        name,
        {
          name,
          synthesizedStackPath: `stacks/${name}/cdk.tf.json`,
          workingDirectory: `stacks/${name}`,
        },
      ]),
    ),
  };

  await fs.writeFile(`${outdir}/manifest.json`, JSON.stringify(manifest, null, 2));

  return ok(undefined);
};
