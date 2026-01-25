import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseProviderVersionFromLockFile } from "./fetch-schema.js";

describe("parseProviderVersionFromLockFile", () => {
  const testDir = join(tmpdir(), `tfts-test-lock-${Date.now()}`);
  const lockFilePath = join(testDir, ".terraform.lock.hcl");

  test("extracts version from single provider lock file", () => {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(
      lockFilePath,
      `provider "registry.terraform.io/hashicorp/google" {
  version = "6.49.2"
  hashes = [
    "h1:abc123",
  ]
}
`,
    );

    const version = parseProviderVersionFromLockFile(
      lockFilePath,
      "registry.terraform.io/hashicorp/google",
    );

    expect(version).toBe("6.49.2");
    rmSync(testDir, { recursive: true, force: true });
  });

  test("extracts version from multi-provider lock file", () => {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(
      lockFilePath,
      `provider "registry.terraform.io/hashicorp/aws" {
  version = "5.0.0"
  hashes = [
    "h1:def456",
  ]
}

provider "registry.terraform.io/hashicorp/google" {
  version = "7.16.0"
  hashes = [
    "h1:abc123",
  ]
}
`,
    );

    const version = parseProviderVersionFromLockFile(
      lockFilePath,
      "registry.terraform.io/hashicorp/google",
    );

    expect(version).toBe("7.16.0");
    rmSync(testDir, { recursive: true, force: true });
  });

  test("returns undefined for non-existent provider", () => {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(
      lockFilePath,
      `provider "registry.terraform.io/hashicorp/aws" {
  version = "5.0.0"
}
`,
    );

    const version = parseProviderVersionFromLockFile(
      lockFilePath,
      "registry.terraform.io/hashicorp/google",
    );

    expect(version).toBeUndefined();
    rmSync(testDir, { recursive: true, force: true });
  });

  test("handles provider name with special regex characters", () => {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(
      lockFilePath,
      `provider "registry.terraform.io/some-org/some.provider" {
  version = "1.2.3"
}
`,
    );

    const version = parseProviderVersionFromLockFile(
      lockFilePath,
      "registry.terraform.io/some-org/some.provider",
    );

    expect(version).toBe("1.2.3");
    rmSync(testDir, { recursive: true, force: true });
  });
});
