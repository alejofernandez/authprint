'use client';

// Target-pick mode (US-137): the state that lets a node be connected to another
// existing node without dragging from a 6×6 handle.
//
// It rides a context rather than node data on purpose. Every node view already
// wraps its body in `CanvasNodeRoot`, so one consumer there covers all six
// types; threading a flag through `flowToReactFlow` would mean six view edits
// and a new field on `CanvasNodeData` that only matters for a transient mode.

import { createContext, useContext } from 'react';

export type ConnectMode = {
  /** The node the pending edge leaves from — stays anchored and highlighted. */
  sourceId: string;
  /** Can an edge legally land on this node? Backed by `validateConnection`, the
   *  same rule the drag path uses — never a second copy of it. */
  canTarget: (nodeId: string) => boolean;
  /** Commit the edge. One undo step; may defer to the action picker (US-125). */
  pick: (nodeId: string) => void;
};

const ConnectModeContext = createContext<ConnectMode | null>(null);

export const ConnectModeProvider = ConnectModeContext.Provider;

/** The mode a node finds itself in, or `null` when target-pick is not running. */
export function useConnectRole(nodeId: string): {
  role: 'source' | 'candidate' | 'blocked';
  pick: () => void;
} | null {
  const mode = useContext(ConnectModeContext);
  if (!mode) return null;
  if (nodeId === mode.sourceId) return { role: 'source', pick: () => {} };
  const ok = mode.canTarget(nodeId);
  return { role: ok ? 'candidate' : 'blocked', pick: () => mode.pick(nodeId) };
}

/** Chrome for the three states. Only two of them decorate: the source is
 *  highlighted so the pending edge has a visible origin, and blocked nodes dim.
 *  **Candidates stay normal on purpose** — ringing them decorates most of the
 *  canvas at once, which reads as noise rather than as an invitation, and the
 *  contrast against the dimmed minority already carries the meaning.
 *  Blocked nodes are also unfocusable and unclickable in `CanvasNodeRoot`, so
 *  the dimming describes a restriction that holds rather than suggesting one. */
export const CONNECT_ROLE_CLASS = {
  source: 'ring-2 ring-accent-primary ring-offset-2 ring-offset-bg-canvas',
  candidate: 'cursor-pointer',
  blocked: 'opacity-40',
} as const;
