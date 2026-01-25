import { command } from "cleye";
import { forceUnlock } from "../force-unlock.js";

export const forceUnlockCommand = command(
  {
    name: "force-unlock",
    help: {
      description: "Release a stuck lock on the current workspace (terraform force-unlock)",
    },
    parameters: ["[stack]", "<lockId>"],
    flags: {
      output: {
        type: String,
        description: "Output directory (default: cdktf.out)",
      },
      force: {
        type: Boolean,
        alias: "f",
        description: "Don't ask for confirmation",
      },
    },
  },
  async (argv) => {
    await forceUnlock({
      stack: argv._.stack,
      lockId: argv._.lockId,
      output: argv.flags.output,
      force: argv.flags.force,
    });
  },
);
