import { command } from "cleye";
import { diff } from "../diff.js";

export const diffCommand = command(
  {
    name: "diff",
    alias: "plan",
    help: {
      description: "Perform a diff (terraform plan) for the given stack",
    },
    parameters: ["[stack]"],
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
        description: "Skip synthesis before diff",
      },
      refreshOnly: {
        type: Boolean,
        description: "Check for drift without proposing changes",
      },
      target: {
        type: [String],
        description: "Target specific resource (can be used multiple times)",
      },
    },
  },
  async (argv) => {
    await diff({
      stack: argv._.stack,
      app: argv.flags.app,
      output: argv.flags.output,
      skipSynth: argv.flags.skipSynth,
      refreshOnly: argv.flags.refreshOnly,
      target: argv.flags.target,
    });
  },
);
