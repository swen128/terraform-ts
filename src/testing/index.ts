import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { App } from "../facade/app.js";
import { invokeAspects } from "../facade/aspects.js";
import { Construct, type IConstruct } from "../facade/construct.js";
import { TerraformStack } from "../facade/terraform-stack.js";

export type TerraformJson = {
  "//": Record<string, unknown>;
  terraform?: {
    backend?: Record<string, Record<string, unknown>>;
    required_providers?: Record<string, unknown>;
  };
  provider?: Record<string, unknown[]>;
  resource?: Record<string, Record<string, Record<string, unknown>>>;
  data?: Record<string, Record<string, Record<string, unknown>>>;
  variable?: Record<string, Record<string, unknown>>;
  output?: Record<string, Record<string, unknown>>;
  locals?: Record<string, unknown>;
  module?: Record<string, Record<string, unknown>>;
}

export type IScopeCallback = {
  (scope: Construct): void;
}

export type TestingAppConfig = {
  readonly outdir?: string;
  readonly stackTraces?: boolean;
  readonly stubVersion?: boolean;
  readonly context?: Record<string, unknown>;
}

const DefaultTestingAppConfig: TestingAppConfig = {
  stackTraces: false,
  stubVersion: true,
};

export class Testing {
  static app(options: TestingAppConfig = {}): App {
    const appConfig = { ...DefaultTestingAppConfig, ...options };
    const outdir = appConfig.outdir ?? mkdtempSync(join(tmpdir(), "tfts.outdir."));

    const app = new App({
      outdir,
      stackTraces: appConfig.stackTraces,
      context: options.context,
    });

    if (appConfig.stubVersion) {
      this.stubVersion(app);
    }

    return app;
  }

  static stubVersion(app: App): App {
    app.node.setContext("tftsVersion", "stubbed");
    return app;
  }

  static synthScope(fn: IScopeCallback): TerraformJson {
    const stack = new TerraformStack(Testing.app(), "stack");
    fn(stack);
    return Testing.synth(stack);
  }

  static synth(stack: TerraformStack, runValidations = false): TerraformJson {
    invokeAspects(stack);

    if (runValidations) {
      const errors = stack.node.validate();
      if (errors.length > 0) {
        throw new Error(`Validation errors:\n${errors.join("\n")}`);
      }
    }

    const tfConfig = stack.toTerraform();
    return tfConfig as TerraformJson;
  }

  static synthToJson(stack: TerraformStack, runValidations = false): string {
    const config = Testing.synth(stack, runValidations);
    const cleaned = removeMetadata(config);

    const sortedKeys =
      typeof cleaned === "object" && cleaned !== null
        ? Object.keys(cleaned as Record<string, unknown>).sort()
        : undefined;
    return JSON.stringify(cleaned, sortedKeys, 2);
  }

  static renderConstructTree(construct: IConstruct): string {
    return renderTree(construct, 0, false);
  }

  static toHaveResource(
    received: TerraformJson,
    resourceType: string,
    properties: Record<string, unknown> = {},
  ): boolean {
    return hasResourceWithProperties(received, "resource", resourceType, properties);
  }

  static toHaveResourceWithProperties(
    received: TerraformJson,
    resourceType: string,
    properties: Record<string, unknown>,
  ): boolean {
    return hasResourceWithProperties(received, "resource", resourceType, properties);
  }

  static toHaveDataSource(
    received: TerraformJson,
    resourceType: string,
    properties: Record<string, unknown> = {},
  ): boolean {
    return hasResourceWithProperties(received, "data", resourceType, properties);
  }

  static toHaveProvider(
    received: TerraformJson,
    providerType: string,
    properties: Record<string, unknown> = {},
  ): boolean {
    return hasProviderWithProperties(received, providerType, properties);
  }
}

function removeMetadata(item: unknown): unknown {
  if (item === null || typeof item !== "object") {
    return item;
  }

  if (Array.isArray(item)) {
    return item.map(removeMetadata);
  }

  const obj = item as Record<string, unknown>;
  const cleaned: Record<string, unknown> = {};

  for (const key of Object.keys(obj).sort()) {
    if (key === "//") continue;
    cleaned[key] = removeMetadata(obj[key]);
  }

  return cleaned;
}

function renderTree(construct: IConstruct, level: number, isLast: boolean): string {
  let prefix = "";
  if (level > 0) {
    const spaces = " ".repeat((level - 1) * 4);
    const symbol = isLast ? "└" : "├";
    prefix = `${spaces}${symbol}── `;
  }

  const name = App.isApp(construct)
    ? "App"
    : `${construct.node.id} (${construct.constructor.name})`;

  const childLines = construct.node.children.map((child, idx, arr) => {
    const isLastChild = idx === arr.length - 1;
    return renderTree(child, level + 1, isLastChild);
  });

  return `${prefix}${name}\n${childLines.join("")}`;
}

function hasResourceWithProperties(
  config: TerraformJson,
  blockType: "resource" | "data",
  resourceType: string,
  expectedProps: Record<string, unknown>,
): boolean {
  const block = config[blockType];
  if (!block) return false;

  const resources = block[resourceType];
  if (!resources) return false;

  const instances = Object.values(resources);
  if (instances.length === 0) return false;

  for (const instance of instances) {
    if (matchesProperties(instance as Record<string, unknown>, expectedProps)) {
      return true;
    }
  }

  return false;
}

function hasProviderWithProperties(
  config: TerraformJson,
  providerType: string,
  expectedProps: Record<string, unknown>,
): boolean {
  const providers = config.provider;
  if (!providers) return false;

  const providerList = providers[providerType];
  if (!providerList || !Array.isArray(providerList)) return false;

  for (const provider of providerList) {
    if (matchesProperties(provider as Record<string, unknown>, expectedProps)) {
      return true;
    }
  }

  return false;
}

function matchesProperties(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
): boolean {
  for (const [key, value] of Object.entries(expected)) {
    if (!(key in actual)) return false;

    if (typeof value === "object" && value !== null) {
      if (typeof actual[key] !== "object" || actual[key] === null) {
        return false;
      }
      if (
        !matchesProperties(actual[key] as Record<string, unknown>, value as Record<string, unknown>)
      ) {
        return false;
      }
    } else if (actual[key] !== value) {
      return false;
    }
  }

  return true;
}
