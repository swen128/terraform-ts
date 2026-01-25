import { command } from "cleye";
import { list } from "../list.js";

export const listCommand = command(
  {
    name: "list",
    alias: "ls",
    help: {
      description: "List all stacks in the app",
    },
    flags: {
      app: {
        type: String,
        description: "Command to run the app",
      },
      output: {
        type: String,
        description: "Output directory (default: cdktf.out)",
      },
      skipSynth: {
        type: Boolean,
        description: "Skip synthesis before listing",
      },
    },
  },
  async (argv) => {
    await list({
      app: argv.flags.app,
      output: argv.flags.output,
      skipSynth: argv.flags.skipSynth,
    });
  },
);
