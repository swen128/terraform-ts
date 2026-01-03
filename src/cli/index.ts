import { runSynth, type SynthOptions } from "./synth.js";
import { runGet, type GetOptions, type GetError } from "./get.js";

const VERSION = "0.1.0";

type Command = "synth" | "get" | "help" | "version";

type ParsedArgs = {
  readonly command: Command;
  readonly options: Record<string, string | boolean>;
  readonly args: readonly string[];
};

const parseArgs = (argv: readonly string[]): ParsedArgs => {
  const args = argv.slice(2);
  const options: Record<string, string | boolean> = {};
  const positional: string[] = [];
  let command: Command = "help";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) continue;

    if (arg === "--help" || arg === "-h") {
      command = "help";
    } else if (arg === "--version" || arg === "-v") {
      command = "version";
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg !== undefined && !nextArg.startsWith("-")) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = true;
      }
    } else if (arg === "synth" || arg === "get") {
      command = arg;
    } else {
      positional.push(arg);
    }
  }

  return { command, options, args: positional };
};

const printHelp = (): void => {
  console.log(`
tfts - Terraform CDK TypeScript

Usage: tfts <command> [options]

Commands:
  synth     Synthesize Terraform configuration
  get       Generate provider bindings

Options:
  --help, -h      Show help
  --version, -v   Show version

Synth Options:
  --app           App command to run
  --output        Output directory
  --config        Config file path (default: cdktf.json)

Get Options:
  --output        Output directory for generated bindings
`);
};

const printVersion = (): void => {
  console.log(`tfts v${VERSION}`);
};

export const run = async (argv: readonly string[]): Promise<number> => {
  const parsed = parseArgs(argv);

  switch (parsed.command) {
    case "help": {
      printHelp();
      return 0;
    }
    case "version": {
      printVersion();
      return 0;
    }
    case "synth": {
      const options: SynthOptions = {
        app: typeof parsed.options["app"] === "string" ? parsed.options["app"] : undefined,
        output: typeof parsed.options["output"] === "string" ? parsed.options["output"] : undefined,
        configPath:
          typeof parsed.options["config"] === "string" ? parsed.options["config"] : undefined,
      };
      const result = await runSynth(options);
      if (result.isErr()) {
        console.error(`Error: ${formatSynthError(result.error)}`);
        return 1;
      }
      return 0;
    }
    case "get": {
      const options: GetOptions = {
        output: typeof parsed.options["output"] === "string" ? parsed.options["output"] : undefined,
        configPath:
          typeof parsed.options["config"] === "string" ? parsed.options["config"] : undefined,
      };
      const result = await runGet(options);
      if (result.isErr()) {
        console.error(`Error: ${formatGetError(result.error)}`);
        return 1;
      }
      return 0;
    }
  }
};

const formatSynthError = (error: {
  readonly kind: string;
  readonly error?: { readonly message: string };
  readonly message?: string;
}): string => {
  if (error.kind === "config" && error.error !== undefined) {
    return error.error.message;
  }
  return error.message ?? "Unknown error";
};

const formatGetError = (error: GetError): string => {
  switch (error.kind) {
    case "config":
      return error.error.message;
    case "schema":
      return error.error.message;
    case "io":
      return error.message;
  }
};
