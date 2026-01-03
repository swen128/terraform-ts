import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateProvider } from "../generator.js";
import type { ProviderSchema } from "../schema.js";

const loadFixture = (name: string): ProviderSchema => {
  const path = join(import.meta.dir, "fixtures", `${name}.json`);
  return JSON.parse(readFileSync(path, "utf-8")) as ProviderSchema;
};

describe("generateProvider", () => {
  test("generates provider with resources and data sources", () => {
    const schema = loadFixture("simple-provider");
    const result = generateProvider("simple", schema);
    expect(result).toMatchSnapshot();
  });
});
