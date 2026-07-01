// Y.UndoManager wiring for E27 / US-053. Tracks the six editable maps, scoped
// to LOCAL_ORIGIN so v2 remote edits never land on the local undo stack.
// Construct the manager only after hydrate — the loaded baseline is not undoable.

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type * as Y from 'yjs';
import { UndoManager } from 'yjs';
import {
  contextMap,
  edgeLayoutMap,
  edgesMap,
  LOCAL_ORIGIN,
  layoutMap,
  metaMap,
  nodesMap,
} from './schema.ts';

export type UndoStackSnapshot = { canUndo: boolean; canRedo: boolean };

/** True when canvas undo should defer to native field undo (US-054). */
export function shouldDeferUndoToField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }
  return target.isContentEditable;
}

/** Headless-friendly factory — also used by the React hook. */
export function createUndoManager(doc: Y.Doc): UndoManager {
  return new UndoManager(
    [
      nodesMap(doc),
      edgesMap(doc),
      contextMap(doc),
      layoutMap(doc),
      edgeLayoutMap(doc),
      metaMap(doc),
    ],
    {
      trackedOrigins: new Set([LOCAL_ORIGIN]),
      captureTimeout: 0,
    },
  );
}

const STACK_EVENTS = [
  'stack-item-added',
  'stack-item-popped',
  'stack-item-updated',
  'stack-cleared',
] as const;

export function useUndoManager(doc: Y.Doc) {
  const manager = useMemo(() => createUndoManager(doc), [doc]);

  useEffect(() => () => manager.destroy(), [manager]);

  const cache = useRef<{ manager: UndoManager; snapshot: UndoStackSnapshot } | null>(null);

  const subscribe = useCallback(
    (onChange: () => void) => {
      const onStack = () => {
        cache.current = null;
        onChange();
      };
      for (const event of STACK_EVENTS) manager.on(event, onStack);
      return () => {
        for (const event of STACK_EVENTS) manager.off(event, onStack);
      };
    },
    [manager],
  );

  const getSnapshot = useCallback((): UndoStackSnapshot => {
    const canUndo = manager.canUndo();
    const canRedo = manager.canRedo();
    if (
      cache.current?.manager === manager &&
      cache.current.snapshot.canUndo === canUndo &&
      cache.current.snapshot.canRedo === canRedo
    ) {
      return cache.current.snapshot;
    }
    const snapshot = { canUndo, canRedo };
    cache.current = { manager, snapshot };
    return snapshot;
  }, [manager]);

  const { canUndo, canRedo } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const undo = useCallback(() => {
    manager.undo();
  }, [manager]);

  const redo = useCallback(() => {
    manager.redo();
  }, [manager]);

  return { undo, redo, canUndo, canRedo };
}
