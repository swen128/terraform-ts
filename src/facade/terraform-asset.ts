import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, posix, resolve } from "node:path";
import { Construct } from "./construct.js";
import { TerraformStack } from "./terraform-stack.js";

const ASSETS_DIRECTORY = "assets";
const ARCHIVE_NAME = "archive.zip";

export enum AssetType {
  FILE = 0,
  DIRECTORY = 1,
  ARCHIVE = 2,
}

export type TerraformAssetConfig = {
  readonly path: string;
  readonly type?: AssetType;
  readonly assetHash?: string;
};

export class TerraformAsset extends Construct {
  private _stack: TerraformStack;
  private _sourcePath: string;
  readonly assetHash: string;
  readonly type: AssetType;

  constructor(scope: Construct, id: string, config: TerraformAssetConfig) {
    super(scope, id);

    this._stack = TerraformStack.of(this);

    if (isAbsolute(config.path)) {
      this._sourcePath = config.path;
    } else {
      const cwd = process.cwd();
      this._sourcePath = resolve(cwd, config.path);
    }

    const stat = statSync(this._sourcePath);
    const inferredType = stat.isFile() ? AssetType.FILE : AssetType.DIRECTORY;
    this.type = config.type ?? inferredType;

    if (stat.isFile() && this.type !== AssetType.FILE) {
      throw new Error(`Asset ${id} is a file but type is set to directory`);
    }

    if (!stat.isFile() && this.type === AssetType.FILE) {
      throw new Error(`Asset ${id} is a directory but type is set to file`);
    }

    this.assetHash = config.assetHash ?? this.computeHash(this._sourcePath);
  }

  private get namedFolder(): string {
    return posix.join(ASSETS_DIRECTORY, this._stack.getLogicalId(this));
  }

  get path(): string {
    return posix.join(
      this.namedFolder,
      this.assetHash,
      this.type === AssetType.DIRECTORY ? "" : this.fileName,
    );
  }

  get fileName(): string {
    switch (this.type) {
      case AssetType.ARCHIVE:
        return ARCHIVE_NAME;
      case AssetType.FILE:
      case AssetType.DIRECTORY:
        return basename(this._sourcePath);
      default: {
        const exhaustiveCheck: never = this.type;
        throw new Error(`Unexpected asset type: ${exhaustiveCheck}`);
      }
    }
  }

  get sourcePath(): string {
    return this._sourcePath;
  }

  private computeHash(filePath: string): string {
    const hash = createHash("sha256");
    const stat = statSync(filePath);

    if (stat.isFile()) {
      const content = readFileSync(filePath);
      hash.update(content);
    } else {
      this.hashDirectory(filePath, hash);
    }

    return hash.digest("hex").slice(0, 16);
  }

  private hashDirectory(dirPath: string, hash: ReturnType<typeof createHash>): void {
    const entries = readdirSync(dirPath, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      hash.update(entry.name);
      if (entry.isFile()) {
        hash.update(readFileSync(fullPath));
      } else if (entry.isDirectory()) {
        this.hashDirectory(fullPath, hash);
      }
    }
  }

  copyToOutputDir(outputDir: string): void {
    const targetPath = join(outputDir, this.path);
    const targetDir = this.type === AssetType.DIRECTORY ? targetPath : dirname(targetPath);

    mkdirSync(targetDir, { recursive: true });

    switch (this.type) {
      case AssetType.FILE:
        copyFileSync(this._sourcePath, targetPath);
        break;
      case AssetType.DIRECTORY:
        this.copyDirectory(this._sourcePath, targetPath);
        break;
      case AssetType.ARCHIVE:
        throw new Error("Archive type requires additional implementation");
    }
  }

  private copyDirectory(src: string, dest: string): void {
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src, { withFileTypes: true })) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);
      if (entry.isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        copyFileSync(srcPath, destPath);
      }
    }
  }
}
