#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

function migrateFile(
  filePath: string,
  projectRoot: string,
): { modified: boolean; changes: string[] } {
  const content = readFileSync(filePath, "utf-8");
  let newContent = content;
  const changes: string[] = [];
  const fileDir = dirname(filePath);
  const relToGen = relative(fileDir, join(projectRoot, ".gen"));

  const cdktfCorePattern = /from\s+["']cdktf["']/g;
  if (cdktfCorePattern.test(newContent)) {
    newContent = newContent.replace(cdktfCorePattern, 'from "tfts"');
    changes.push('from "cdktf" -> from "tfts"');
  }

  const constructsPattern = /from\s+["']constructs["']/g;
  if (constructsPattern.test(newContent)) {
    newContent = newContent.replace(constructsPattern, 'from "tfts"');
    changes.push('from "constructs" -> from "tfts"');
  }

  const namespaceImportPattern = /from\s+["']@cdktf\/provider-([^/"']+)["']/g;
  newContent = newContent.replace(namespaceImportPattern, (_, provider) => {
    const newPath = `${relToGen}/providers/hashicorp/${provider}/index.js`;
    changes.push(`@cdktf/provider-${provider} -> ${newPath}`);
    return `from "${newPath}"`;
  });

  const namedImportPattern = /from\s+["']@cdktf\/provider-([^/"']+)\/lib\/([^"']+)["']/g;
  newContent = newContent.replace(namedImportPattern, (_, provider, modulePath) => {
    const newPath = `${relToGen}/providers/hashicorp/${provider}/lib/${modulePath}/index.js`;
    changes.push(`@cdktf/provider-${provider}/lib/${modulePath} -> ${newPath}`);
    return `from "${newPath}"`;
  });

  if (content !== newContent) writeFileSync(filePath, newContent);
  return { modified: content !== newContent, changes };
}

function findTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];
  const skipDirs = new Set(["node_modules", ".gen", "cdktf.out", "dist", ".git"]);
  function walk(currentDir: string) {
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory() && !skipDirs.has(entry.name)) walk(fullPath);
      else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) files.push(fullPath);
    }
  }
  walk(dir);
  return files;
}

const targetDir = resolve(process.argv[2] || ".");
if (!existsSync(targetDir) || !statSync(targetDir).isDirectory()) {
  console.error(`Error: "${targetDir}" is not a valid directory`);
  process.exit(1);
}

console.log(`Migrating CDKTF -> tfts in: ${targetDir}\n`);
const files = findTypeScriptFiles(targetDir);
let totalModified = 0;

for (const file of files) {
  const { modified, changes } = migrateFile(file, targetDir);
  if (modified) {
    totalModified++;
    console.log(file);
    for (const change of changes) console.log(`  ${change}`);
  }
}

console.log(`\n${totalModified} file(s) modified`);
if (totalModified > 0) console.log("\nNext: npx tfts get");
