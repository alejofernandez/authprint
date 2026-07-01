// Tracks edits not yet written to a file on disk — separate from Recent autosave
// (US-089), which flushes on a timer. Resets only via markExported().

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type * as Y from 'yjs';
import {
  contextMap,
  edgeLayoutMap,
  edgesMap,
  layoutMap,
  metaMap,
  nodesMap,
} from '../ydoc/schema.ts';

export type UnexportedChangesTracker = {
  hasUnexportedChanges: () => boolean;
  markExported: () => void;
  destroy: () => void;
};

export function trackedDocMaps(doc: Y.Doc) {
  return [
    nodesMap(doc),
    edgesMap(doc),
    contextMap(doc),
    layoutMap(doc),
    edgeLayoutMap(doc),
    metaMap(doc),
  ];
}

/** Headless tracker — also wrapped by the React hook. */
export function createUnexportedChangesTracker(
  doc: Y.Doc,
  onDirty?: () => void,
): UnexportedChangesTracker {
  let dirty = false;
  let destroyed = false;

  const markDirty = () => {
    if (destroyed) return;
    if (!dirty) {
      dirty = true;
      onDirty?.();
    }
  };

  for (const map of trackedDocMaps(doc)) {
    map.observeDeep(markDirty);
  }

  return {
    hasUnexportedChanges: () => dirty,
    markExported: () => {
      dirty = false;
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      for (const map of trackedDocMaps(doc)) {
        map.unobserveDeep(markDirty);
      }
    },
  };
}

export function useUnexportedChanges(doc: Y.Doc): {
  hasUnexportedChanges: boolean;
  markExported: () => void;
} {
  const listeners = useRef(new Set<() => void>());
  const dirtyRef = useRef(false);
  const trackerRef = useRef<UnexportedChangesTracker | null>(null);

  const notify = useCallback(() => {
    for (const listener of listeners.current) listener();
  }, []);

  useEffect(() => {
    dirtyRef.current = false;
    notify();

    const tracker = createUnexportedChangesTracker(doc, () => {
      dirtyRef.current = true;
      notify();
    });
    trackerRef.current = tracker;

    return () => {
      tracker.destroy();
      trackerRef.current = null;
      dirtyRef.current = false;
    };
  }, [doc, notify]);

  const subscribe = useCallback((onChange: () => void) => {
    listeners.current.add(onChange);
    return () => {
      listeners.current.delete(onChange);
    };
  }, []);

  const getSnapshot = useCallback(() => dirtyRef.current, []);

  const dirty = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const markExported = useCallback(() => {
    trackerRef.current?.markExported();
    dirtyRef.current = false;
    notify();
  }, [notify]);

  return { hasUnexportedChanges: dirty, markExported };
}
