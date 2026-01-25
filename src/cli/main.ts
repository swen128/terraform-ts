#!/usr/bin/env node
import { cli } from "cleye";
import { diffCommand } from "./commands/diff.js";
import { getCommand } from "./commands/get.js";
import { synthCommand } from "./commands/synth.js";

const parsed = cli(
  {
    name: "tfts",
    version: "0.3.2",
    help: {
      description: "Terraform TypeScript SDK",
    },
    commands: [synthCommand, getCommand, diffCommand],
  },
  () => {
    console.log('Run "tfts --help" for usage information.');
  },
);

parsed.catch((error: Error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
