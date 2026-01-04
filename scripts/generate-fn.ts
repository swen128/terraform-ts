/**
 * Generates src/core/fn.generated.ts
 * Usage: bun run scripts/generate-fn.ts
 * Requires: terraform >= 1.4.0
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { generateFnClass, parseFunctionsMetadata } from "../src/codegen/fn-generator.js";

const main = async (): Promise<void> => {
  const json = execSync("terraform metadata functions -json").toString();
  const metadata = parseFunctionsMetadata(JSON.parse(json));
  const code = generateFnClass(metadata);
  const outPath = path.join(import.meta.dir, "..", "src", "generated", "fn.ts");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, code);
  console.log(`Generated ${outPath}`);
};

main().catch(console.error);
