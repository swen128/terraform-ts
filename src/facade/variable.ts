import { Construct } from "./construct.js";
import type { TerraformStack } from "./stack.js";
import type { ValidationDef } from "../core/variable.js";
import type { Token } from "../core/tokens.js";
import { raw } from "../core/tokens.js";

export type TerraformVariableConfig = {
  readonly type?: string;
  readonly default?: unknown;
  readonly description?: string;
  readonly sensitive?: boolean;
  readonly nullable?: boolean;
  readonly validation?: readonly ValidationDef[];
};

export class TerraformVariable extends Construct {
  readonly type?: string;
  readonly default?: unknown;
  readonly description?: string;
  readonly sensitive?: boolean;
  readonly nullable?: boolean;
  readonly validation?: readonly ValidationDef[];

  constructor(scope: TerraformStack, id: string, config: TerraformVariableConfig = {}) {
    super(scope, id, {
      kind: "variable",
      variable: {
        type: config.type,
        default: config.default,
        description: config.description,
        sensitive: config.sensitive,
        nullable: config.nullable,
        validation: config.validation,
      },
    });

    this.type = config.type;
    this.default = config.default;
    this.description = config.description;
    this.sensitive = config.sensitive;
    this.nullable = config.nullable;
    this.validation = config.validation;
  }

  get value(): Token {
    return raw(`var.${this.node.id}`);
  }

  get stringValue(): string {
    return `\${var.${this.node.id}}`;
  }

  get numberValue(): Token {
    return raw(`var.${this.node.id}`);
  }

  get booleanValue(): Token {
    return raw(`var.${this.node.id}`);
  }

  get listValue(): Token {
    return raw(`var.${this.node.id}`);
  }
}
