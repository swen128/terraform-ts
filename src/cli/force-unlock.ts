import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";

export type ForceUnlockOptions = {
  stack?: string;
  lockId: string;
  output?: string;
  cwd?: string;
  force?: boolean;
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

export async function forceUnlock(options: ForceUnlockOptions): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const outputDir = options.output ?? "cdktf.out";
  const outputPath = `${cwd}/${outputDir}`;

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
      `Found more than one stack, please specify a target stack. Run tfts force-unlock <stack> <lock-id> with one of these stacks: ${stacks.join(", ")}`,
    );
  }

  const stackDir = `${outputPath}/stacks/${targetStack}`;

  const unlockArgs = ["force-unlock"];
  if (options.force === true) {
    unlockArgs.push("-force");
  }
  unlockArgs.push(options.lockId);

  const unlockCode = await runCommand("terraform", unlockArgs, stackDir);
  if (unlockCode !== 0) {
    throw new Error(`terraform force-unlock failed for stack ${targetStack}`);
  }
}
