import type { IConstruct } from "./construct.js";

const aspectsRegistry = new WeakMap<IConstruct, Aspects>();

export type IAspect = {
  visit(node: IConstruct): void;
};

export class Aspects {
  static of(scope: IConstruct): Aspects {
    const existing = aspectsRegistry.get(scope);
    if (existing !== undefined) {
      return existing;
    }
    const aspects = new Aspects();
    aspectsRegistry.set(scope, aspects);
    return aspects;
  }

  private readonly _aspects: IAspect[] = [];

  private constructor() {}

  add(aspect: IAspect): void {
    this._aspects.push(aspect);
  }

  get all(): IAspect[] {
    return [...this._aspects];
  }
}

export function invokeAspects(root: IConstruct): void {
  recurse(root, []);

  function recurse(construct: IConstruct, inheritedAspects: IAspect[]): void {
    const localAspects = Aspects.of(construct).all;
    const allAspects = [...inheritedAspects, ...localAspects];

    for (const aspect of allAspects) {
      aspect.visit(construct);
    }

    for (const child of construct.node.children) {
      recurse(child, allAspects);
    }
  }
}
