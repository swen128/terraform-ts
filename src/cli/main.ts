#!/usr/bin/env node
import { cli } from "cleye";
import { deployCommand } from "./commands/deploy.js";
import { destroyCommand } from "./commands/destroy.js";
import { diffCommand } from "./commands/diff.js";
import { forceUnlockCommand } from "./commands/force-unlock.js";
import { getCommand } from "./commands/get.js";
import { listCommand } from "./commands/list.js";
import { outputCommand } from "./commands/output.js";
import { synthCommand } from "./commands/synth.js";

const parsed = cli(
  {
    name: "tfts",
    version: "0.3.4",
    help: {
      description: "Terraform TypeScript SDK",
    },
    commands: [
      synthCommand,
      getCommand,
      diffCommand,
      deployCommand,
      destroyCommand,
      listCommand,
      outputCommand,
      forceUnlockCommand,
    ],
  },
  () => {
    console.log('Run "tfts --help" for usage information.');
  },
);

parsed.catch((error: Error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
