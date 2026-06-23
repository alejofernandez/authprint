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
// node is selected; otherwise it fades in on group-hover of the node card.
const SIDE: Record<'right' | 'bottom', string> = {
  right: 'top-1/2 -right-3 -translate-y-1/2 translate-x-full',
  bottom: 'left-1/2 -bottom-3 -translate-x-1/2 translate-y-full',
};

export function HandlePlus({
  handleId,
  position,
  force,
}: {
  /** Source handle id this `+` creates from (null = the node's sole handle). */
  handleId: string | null;
  /** Which side the handle is on — drives placement. */
  position: 'right' | 'bottom';
  /** Force-visible (node selected). Otherwise hover-reveal. */
  force?: boolean;
}) {
  const open = useNodeCreate();
  const sourceId = useNodeId();
  if (!open || !sourceId) return null;

  return (
    <button
      type="button"
      // `nodrag`/`nopan` keep React Flow from treating the click as a node drag.
      className={`nodrag nopan absolute z-10 grid h-5 w-5 place-items-center rounded-full border border-zinc-300 bg-white text-zinc-500 text-xs leading-none shadow-sm transition-opacity hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-indigo-400 ${SIDE[position]} ${force ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
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
