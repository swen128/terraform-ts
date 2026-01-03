import { Construct } from "./construct.js";
import type { TerraformStack } from "./stack.js";
import type { Token } from "../core/tokens.js";
import { raw } from "../core/tokens.js";

export type TerraformLocalConfig = {
  readonly expression: unknown;
};

export class TerraformLocal extends Construct {
  readonly expression: unknown;

  constructor(scope: TerraformStack, id: string, config: TerraformLocalConfig) {
    super(scope, id, {
      kind: "local",
      local: {
        expression: config.expression,
      },
    });

    this.expression = config.expression;
  }

  get asString(): string {
    return `\${local.${this.node.id}}`;
  }

  get asNumber(): Token {
    return raw(`\${local.${this.node.id}}`);
  }

  get asBoolean(): Token {
    return raw(`\${local.${this.node.id}}`);
  }

  get asList(): Token {
    return raw(`\${local.${this.node.id}}`);
  }
}
