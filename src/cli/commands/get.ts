import { command } from "cleye";
import { get } from "../get.js";

export const getCommand = command(
  {
    name: "get",
    help: {
      description: "Generate provider/module bindings",
    },
    flags: {
      output: {
        type: String,
        description: "Output directory (default: .gen)",
      },
      providers: {
        type: String,
        description: "Comma-separated provider list",
      },
      modules: {
        type: String,
        description: "Comma-separated module list",
      },
    },
  },
  async (argv) => {
    await get({
      output: argv.flags.output,
      providers: argv.flags.providers?.split(","),
      modules: argv.flags.modules?.split(","),
    });
  },
);
