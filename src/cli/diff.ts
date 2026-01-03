import { ok, err, type Result } from "neverthrow";
import { z } from "zod";
import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { readConfig, type ConfigError } from "./config.js";
import { executeApp } from "./synth.js";

const ManifestStackSchema = z.object({
  name: z.string(),
  synthesizedStackPath: z.string(),
  workingDirectory: z.string(),
});

const ManifestSchema = z.object({
  version: z.string(),
  stacks: z.record(z.string(), ManifestStackSchema),
});

type Manifest = z.infer<typeof ManifestSchema>;

export type DiffOptions = {
  readonly configPath?: string;
  readonly output?: string;
  readonly app?: string;
  readonly stack?: string;
  readonly refreshOnly?: boolean;
  readonly skipSynth?: boolean;
};

export type DiffError =
  | { readonly kind: "config"; readonly error: ConfigError }
  | { readonly kind: "exec"; readonly message: string }
  | { readonly kind: "io"; readonly message: string }
  | { readonly kind: "terraform"; readonly message: string };

export const runDiff = async (options: DiffOptions): Promise<Result<void, DiffError>> => {
  const configPath = options.configPath ?? "cdktf.json";
  const configResult = await readConfig(configPath);

  if (configResult.isErr()) {
    return err({ kind: "config", error: configResult.error });
  }

  const config = configResult.value;
  const appCommand = options.app ?? config.app;
  const outdir = options.output ?? config.output;

  // Step 1: Synthesize (unless skipped)
  if (options.skipSynth !== true) {
    console.log("Synthesizing...");
    const synthResult = await executeApp(appCommand, outdir);
    if (synthResult.isErr()) {
      const synthError = synthResult.error;
      const message = synthError.kind === "exec" ? synthError.message : "Synth failed";
      return err({ kind: "exec", message });
    }
  }

  // Step 2: Read manifest to get stacks
  const manifestPath = `${outdir}/manifest.json`;

  if (!existsSync(manifestPath)) {
    return err({ kind: "io", message: `Manifest not found: ${manifestPath}` });
  }

  const manifestText = await fs.readFile(manifestPath, "utf-8");
  const manifestJson: unknown = JSON.parse(manifestText);
  const manifestResult = ManifestSchema.safeParse(manifestJson);

  if (!manifestResult.success) {
    return err({ kind: "io", message: "Invalid manifest.json format" });
  }

  const manifest: Manifest = manifestResult.data;
  const stackNames = Object.keys(manifest.stacks);

  if (stackNames.length === 0) {
    console.log("No stacks found.");
    return ok(undefined);
  }

  // Filter to specific stack if provided
  const targetStacks =
    options.stack !== undefined ? stackNames.filter((name) => name === options.stack) : stackNames;

  if (targetStacks.length === 0) {
    return err({ kind: "io", message: `Stack not found: ${options.stack}` });
  }

  // Step 3: Run terraform init and plan for each stack
  for (const stackName of targetStacks) {
    const stackInfo = manifest.stacks[stackName];
    if (stackInfo === undefined) continue;

    const stackDir = `${outdir}/${stackInfo.workingDirectory}`;
    console.log(`\n--- Stack: ${stackName} ---\n`);

    // terraform init
    const initResult = await runTerraformInit(stackDir);
    if (initResult.isErr()) {
      return initResult;
    }

    // terraform plan
    const planResult = await runTerraformPlan(stackDir, options.refreshOnly ?? false);
    if (planResult.isErr()) {
      return planResult;
    }
  }

  return ok(undefined);
};

const runTerraformInit = async (workingDir: string): Promise<Result<void, DiffError>> => {
  const exitCode = await new Promise<number>((resolve) => {
    const proc = spawn("terraform", ["init", "-input=false"], {
      cwd: workingDir,
      stdio: "inherit",
    });
    proc.on("close", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    return err({ kind: "terraform", message: `terraform init failed with exit code ${exitCode}` });
  }

  return ok(undefined);
};

const runTerraformPlan = async (
  workingDir: string,
  refreshOnly: boolean,
): Promise<Result<void, DiffError>> => {
  const args = ["plan", "-input=false"];
  if (refreshOnly) {
    args.push("-refresh-only");
  }

  const exitCode = await new Promise<number>((resolve) => {
    const proc = spawn("terraform", args, {
      cwd: workingDir,
      stdio: "inherit",
    });
    proc.on("close", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    return err({ kind: "terraform", message: `terraform plan failed with exit code ${exitCode}` });
  }

  return ok(undefined);
};
