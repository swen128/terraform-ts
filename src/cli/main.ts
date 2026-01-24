import { get } from "./get.js";
import { synth } from "./synth.js";

const args = process.argv.slice(2);
const command = args[0];

function parseFlags(args: string[]): Record<string, string | boolean | string[]> {
  const flags: Record<string, string | boolean | string[]> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return flags;
}

async function main(): Promise<void> {
  const flags = parseFlags(args.slice(1));

  switch (command) {
    case "synth":
    case "synthesize":
      await synth({
        app: flags.app as string | undefined,
        output: flags.output as string | undefined,
      });
      break;

    case "get":
      await get({
        output: flags.output as string | undefined,
        providers: flags.providers ? (flags.providers as string).split(",") : undefined,
        modules: flags.modules ? (flags.modules as string).split(",") : undefined,
      });
      break;

    case "help":
    case "--help":
    case "-h":
    case undefined:
      printHelp();
      break;

    default:
      console.error(`Unknown command: ${command}`);
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
