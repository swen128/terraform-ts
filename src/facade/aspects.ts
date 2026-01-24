import type { IConstruct } from "./construct.js";

const ASPECTS_SYMBOL = Symbol.for("tfts/Aspects");

export type IAspect = {
  visit(node: IConstruct): void;
}

export class Aspects {
  static of(scope: IConstruct): Aspects {
    const record = scope as unknown as Record<symbol, Aspects>;
    let aspects = record[ASPECTS_SYMBOL];
    if (!aspects) {
      aspects = new Aspects();
      Object.defineProperty(scope, ASPECTS_SYMBOL, {
        value: aspects,
        configurable: false,
        enumerable: false,
      });
    }
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
