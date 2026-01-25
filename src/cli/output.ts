import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { synth } from "./synth.js";

export type OutputOptions = {
  stack?: string;
  app?: string;
  output?: string;
  cwd?: string;
  skipSynth?: boolean;
  json?: boolean;
};

async function runCommand(command: string, args: readonly string[], cwd: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      stdio: "inherit",
    });
    proc.on("close", (code) => resolve(code ?? 1));
    proc.on("error", reject);
  });
}

function getStacks(outputDir: string): readonly string[] {
  const stacksDir = `${outputDir}/stacks`;
  if (!existsSync(stacksDir)) {
    return [];
  }
  return readdirSync(stacksDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

export async function output(options: OutputOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const outputDir = options.output ?? "cdktf.out";
  const outputPath = `${cwd}/${outputDir}`;

  if (options.skipSynth !== true) {
    await synth({
      app: options.app,
      output: outputDir,
      cwd,
    });
    console.log();
  }

  const stacks = getStacks(outputPath);
  if (stacks.length === 0) {
    throw new Error(`No stacks found in ${outputDir}/stacks`);
  }

  let targetStack: string;

  if (options.stack !== undefined) {
    if (!stacks.includes(options.stack)) {
      throw new Error(`Stack "${options.stack}" not found. Available stacks: ${stacks.join(", ")}`);
    }
    targetStack = options.stack;
  } else if (stacks.length === 1 && stacks[0] !== undefined) {
    targetStack = stacks[0];
  } else {
    throw new Error(
      `Found more than one stack, please specify a target stack. Run tfts output <stack> with one of these stacks: ${stacks.join(", ")}`,
    );
  }

  const stackDir = `${outputPath}/stacks/${targetStack}`;

  const needsInit = !existsSync(`${stackDir}/.terraform`);
  if (needsInit) {
    console.log("Running terraform init...\n");
    const initCode = await runCommand("terraform", ["init"], stackDir);
    if (initCode !== 0) {
      throw new Error(`terraform init failed for stack ${targetStack}`);
    }
    console.log();
  }

  const outputArgs = ["output"];
  if (options.json === true) {
    outputArgs.push("-json");
  }

  const outputCode = await runCommand("terraform", outputArgs, stackDir);
  if (outputCode !== 0) {
    throw new Error(`terraform output failed for stack ${targetStack}`);
  }
}
