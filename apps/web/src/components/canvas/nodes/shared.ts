// Shared type for the `data` payload our canvas attaches to React Flow
// nodes. Each per-structural-type view receives this wrapped in `NodeProps`.

import type { Node } from '@authprint/dsl';

export type CanvasNodeData<TNode extends Node = Node> = {
  /** The original DSL node — single source of truth for rendering. */
  node: TNode;
};
