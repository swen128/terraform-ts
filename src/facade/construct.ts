import type { ConstructNode, ConstructMetadata } from "../core/construct.js";

type MutableNode = {
  readonly id: string;
  readonly path: readonly string[];
  readonly children: MutableNode[];
  readonly metadata: ConstructMetadata;
};

export abstract class Construct {
  readonly #node: MutableNode;

  constructor(scope: Construct | undefined, id: string, metadata: ConstructMetadata) {
    if (scope === undefined) {
      this.#node = {
        id,
        path: [id],
        children: [],
        metadata,
      };
    } else {
      this.#node = {
        id,
        path: [...scope.node.path, id],
        children: [],
        metadata,
      };
      scope.addChildNode(this.#node);
    }
  }

  private addChildNode(child: MutableNode): void {
    this.#node.children.push(child);
  }

  get node(): ConstructNode {
    return this.#node;
  }

  get path(): string {
    return this.#node.path.join("/");
  }
}
