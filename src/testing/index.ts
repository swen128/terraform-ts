import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { App } from "../facade/app.js";
import { invokeAspects } from "../facade/aspects.js";
import type { IConstruct } from "../facade/construct.js";
import { TerraformStack } from "../facade/terraform-stack.js";

function toTestTerraformJson(config: Record<string, unknown>): TerraformJson {
  return config;
}

export type TerraformJson = {
  "//"?: Record<string, unknown>;
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
  validationErrors?: readonly string[];
};

export type IScopeCallback = {
  (scope: TerraformStack): void;
};

export type TestingAppConfig = {
  readonly outdir?: string;
  readonly stackTraces?: boolean;
  readonly stubVersion?: boolean;
  readonly context?: Record<string, unknown>;
};

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

    if (appConfig.stubVersion === true) {
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

    if (runValidations === true) {
      const errors = stack.node.validate();
      if (errors.length > 0) {
        return { validationErrors: errors };
      }
    }

    const tfConfig = stack.toTerraform();
    return toTestTerraformJson(tfConfig);
  }

  static synthToJson(stack: TerraformStack, runValidations = false): string {
    const config = Testing.synth(stack, runValidations);
    const cleaned = removeMetadata(config);

    const sortedKeys =
      typeof cleaned === "object" && cleaned !== null && !Array.isArray(cleaned)
        ? Object.keys(Object.fromEntries(Object.entries(cleaned))).sort()
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

  const obj = Object.fromEntries(Object.entries(item));
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

  const name =
    App.asApp(construct) !== null ? "App" : `${construct.node.id} (${construct.constructor.name})`;

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
    if (typeof instance === "object" && instance !== null && !Array.isArray(instance)) {
      const rec = Object.fromEntries(Object.entries(instance));
      if (matchesProperties(rec, expectedProps)) {
        return true;
      }
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
    if (typeof provider === "object" && provider !== null && !Array.isArray(provider)) {
      const rec = Object.fromEntries(Object.entries(provider));
      if (matchesProperties(rec, expectedProps)) {
        return true;
      }
    }
  }

  return false;
}

function matchesProperties(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
): boolean {
  for (const [key, value] of Object.entries(expected)) {
    if (!Object.prototype.hasOwnProperty.call(actual, key)) return false;

    const actualValue = actual[key];
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      if (typeof actualValue !== "object" || actualValue === null || Array.isArray(actualValue)) {
        return false;
      }
      const actualRec = Object.fromEntries(Object.entries(actualValue));
      const expectedRec = Object.fromEntries(Object.entries(value));
      if (!matchesProperties(actualRec, expectedRec)) {
        return false;
      }
    } else if (actualValue !== value) {
      return false;
    }
  }

  return true;
}
