import { command } from "cleye";
import { synth } from "../synth.js";

export const synthCommand = command(
  {
    name: "synth",
    alias: "synthesize",
    help: {
      description: "Synthesize Terraform configuration",
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
    },
  },
  async (argv) => {
    await synth({
      app: argv.flags.app,
      output: argv.flags.output,
    });
  },
);
