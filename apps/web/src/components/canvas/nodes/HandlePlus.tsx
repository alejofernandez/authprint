// The per-handle `+` affordance (E26 / §7): a small button next to an
// unconnected outgoing handle that creates a connected node via that handle's
// trigger. Revealed on node hover (or while the node is selected) and only on
// handles that can take an edge — so a fully-wired node shows none, and the
// `+`s double as a "what's unfinished here" signal.
//
// The button only reports *which* source + handle was clicked (and where it is
// on screen); the actual create + type-pick lives in the canvas-level provider
// (FlowCanvas) which owns the Y.Doc. Outside that provider (e.g. Storybook) the
// button renders nothing.

import { useNodeId } from '@xyflow/react';
import { createContext, useContext } from 'react';
import { HANDLE_PLUS_FOCUS_VISIBLE } from './nodeA11y.tsx';

/** Open the node-type picker for a `+` clicked on `sourceId`'s `sourceHandle`. */
export type OpenCreateMenu = (
  sourceId: string,
  sourceHandle: string | null,
  anchor: DOMRect,
  /** Which side the handle is on — the new node aligns along this axis. */
  side: 'right' | 'bottom',
) => void;

const NodeCreateContext = createContext<OpenCreateMenu | null>(null);
export const NodeCreateProvider = NodeCreateContext.Provider;
export const useNodeCreate = (): OpenCreateMenu | null => useContext(NodeCreateContext);

// Sits just outside the handle on its side. `force` keeps it visible while the
// node is selected; `anchored` while its picker is open (via node data — React
// Flow won't re-render nodes on context alone).
const SIDE: Record<'right' | 'bottom', string> = {
  right: 'top-1/2 -right-3 -translate-y-1/2 translate-x-full',
  bottom: 'left-1/2 -bottom-3 -translate-x-1/2 translate-y-full',
};

export function HandlePlus({
  handleId,
  position,
  force,
  anchored,
}: {
  /** Source handle id this `+` creates from (null = the node's sole handle). */
  handleId: string | null;
  /** Which side the handle is on — drives placement. */
  position: 'right' | 'bottom';
  /** Force-visible (node selected). Otherwise hover-reveal. */
  force?: boolean;
  /** Picker is open from this handle — stay visible as a visual anchor. */
  anchored?: boolean;
}) {
  const open = useNodeCreate();
  const sourceId = useNodeId();
  if (!open || !sourceId) return null;

  const visible = force || anchored;

  return (
    <button
      type="button"
      // `nodrag`/`nopan` keep React Flow from treating the click as a node drag.
      className={`nodrag nopan absolute grid h-5 w-5 place-items-center rounded-full border border-border-default bg-bg-panel text-fg-subtle text-xs leading-none shadow-sm transition-opacity duration-fast ease-standard hover:border-accent-primary-border hover:text-accent-primary-solid dark:text-fg-muted dark:hover:border-accent-primary-border ${HANDLE_PLUS_FOCUS_VISIBLE} ${SIDE[position]} ${anchored ? 'z-[60]' : 'z-10'} ${visible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
      aria-label="Add connected node"
      onClick={(e) => {
        e.stopPropagation();
        open(sourceId, handleId, e.currentTarget.getBoundingClientRect(), position);
      }}
    >
      +
    </button>
  );
}
