import { command } from "cleye";
import { output } from "../output.js";

export const outputCommand = command(
  {
    name: "output",
    help: {
      description: "Print the output values for a stack (terraform output)",
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
        description: "Skip synthesis before output",
      },
      json: {
        type: Boolean,
        description: "Output in JSON format",
      },
    },
  },
  async (argv) => {
    await output({
      stack: argv._.stack,
      app: argv.flags.app,
      output: argv.flags.output,
      skipSynth: argv.flags.skipSynth,
      json: argv.flags.json,
    });
  },
);
