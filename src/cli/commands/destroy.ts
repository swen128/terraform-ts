import { command } from "cleye";
import { destroy } from "../destroy.js";

export const destroyCommand = command(
  {
    name: "destroy",
    help: {
      description: "Destroy the given stack (terraform destroy)",
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
        description: "Skip synthesis before destroy",
      },
      autoApprove: {
        type: Boolean,
        description: "Skip interactive approval",
      },
      target: {
        type: [String],
        description: "Target specific resource (can be used multiple times)",
      },
    },
  },
  async (argv) => {
    await destroy({
      stack: argv._.stack,
      app: argv.flags.app,
      output: argv.flags.output,
      skipSynth: argv.flags.skipSynth,
      autoApprove: argv.flags.autoApprove,
      target: argv.flags.target,
    });
  },
);
