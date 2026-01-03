#!/usr/bin/env node
import { run } from "../src/cli/index.js";

const exitCode = await run(process.argv);
process.exit(exitCode);
