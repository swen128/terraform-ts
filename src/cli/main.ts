#!/usr/bin/env node
import { get } from "./get.js";
import { synth } from "./synth.js";

const cliArgs = process.argv.slice(2);
const command = cliArgs[0];

function parseFlags(flagArgs: readonly string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < flagArgs.length; i++) {
    const arg = flagArgs[i];
    if (arg === undefined) continue;
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = flagArgs[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return flags;
}

function getStringFlag(flags: Record<string, string | boolean>, key: string): string | undefined {
  const value = flags[key];
  return typeof value === "string" ? value : undefined;
}

async function main(): Promise<void> {
  const flags = parseFlags(cliArgs.slice(1));

  switch (command) {
    case "synth":
    case "synthesize":
      await synth({
        app: getStringFlag(flags, "app"),
        output: getStringFlag(flags, "output"),
      });
      break;

    case "get": {
      const providersStr = getStringFlag(flags, "providers");
      const modulesStr = getStringFlag(flags, "modules");
      await get({
        output: getStringFlag(flags, "output"),
        providers: providersStr !== undefined ? providersStr.split(",") : undefined,
        modules: modulesStr !== undefined ? modulesStr.split(",") : undefined,
      });
      break;
    }

    case "help":
    case "--help":
    case "-h":
    case undefined:
      printHelp();
      break;

    default:
      console.error(`Unknown command: ${String(command)}`);
      printHelp();
      process.exit(1);
  }
}

function printHelp(): void {
  console.log(`
tfts - Terraform CDK TypeScript

Commands:
  synth, synthesize    Synthesize Terraform configuration
  get                  Generate provider/module bindings

Options:
  --app <command>      Command to run the app (synth)
  --output <dir>       Output directory (synth: cdktf.out, get: .gen)
  --providers <list>   Comma-separated provider list (get)
  --modules <list>     Comma-separated module list (get)
  --help, -h           Show this help

Examples:
  tfts synth --app "bun run main.ts"
  tfts get --providers "hashicorp/aws@~>5.0"
`);
}

main().catch((err: Error) => {
  console.error("Error:", err.message);
  process.exit(1);
});
