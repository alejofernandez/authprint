// Shared type for the `data` payload our canvas attaches to React Flow
// nodes. Each per-structural-type view receives this wrapped in `NodeProps`.

import type { Node } from '@authprint/dsl';

export type CanvasNodeData<TNode extends Node = Node> = {
  /** The original DSL node — single source of truth for rendering. */
  node: TNode;
  /**
   * Source-handle ids that already have an outgoing edge (E26). Drives the
   * per-handle `+` affordance: a single-use handle in this set hides its `+`.
   * The unconditional (entry) handle is keyed by `''`. Absent in contexts that
   * don't compute it (e.g. Storybook) → treat as none connected.
   */
  connectedHandles?: ReadonlySet<string>;
  /** Handle whose `+` opened the type picker — keeps that button visible (UF-002). */
  pickerAnchorHandle?: string | null;
};
