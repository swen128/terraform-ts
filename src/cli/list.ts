import { existsSync, readdirSync } from "node:fs";
import { synth } from "./synth.js";

export type ListOptions = {
  app?: string;
  output?: string;
  cwd?: string;
  skipSynth?: boolean;
};

function getStacks(outputDir: string): readonly string[] {
  const stacksDir = `${outputDir}/stacks`;
  if (!existsSync(stacksDir)) {
    return [];
  }
  return readdirSync(stacksDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

export async function list(options: ListOptions = {}): Promise<void> {
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
    console.log("No stacks found.");
    return;
  }

  console.log("Stacks:");
  for (const stack of stacks) {
    console.log(`  - ${stack}`);
  }
}
