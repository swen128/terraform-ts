import type { TerraformElement } from "./terraform-element.js";

export type StackLike = TerraformElement & {
  prepareStack(): void;
  synthesize(): void;
  addDependency(dependency: StackLike): void;
  registerOutgoingCrossStackReference(identifier: string): string;
  registerIncomingCrossStackReference(fromStack: StackLike): {
    getString(output: string): string;
  };
};

const stackRegistry = new WeakMap<object, StackLike>();

export function registerStack(element: object, stack: StackLike): void {
  stackRegistry.set(element, stack);
}

export function getStack(element: object): StackLike | undefined {
  return stackRegistry.get(element);
}
