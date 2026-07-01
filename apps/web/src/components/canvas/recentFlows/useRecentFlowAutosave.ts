// Periodic + lifecycle autosave for the local Recent-flows store (E42 / US-089).

import { useEffect } from 'react';
import type * as Y from 'yjs';
import { docToArtifact, serializeBundle } from '../ydoc/persist.ts';
import {
  contextMap,
  edgeLayoutMap,
  edgesMap,
  layoutMap,
  metaMap,
  nodesMap,
} from '../ydoc/schema.ts';
import { saveRecentFlow } from './store.ts';

export const AUTOSAVE_INTERVAL_MS = 30_000;

export type RecentFlowAutosave = {
  flush: () => Promise<void>;
  destroy: () => void;
  isDirty: () => boolean;
};

type SaveRecentFlowFn = typeof saveRecentFlow;

type LifecycleTarget = {
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

type VisibilityDocument = LifecycleTarget & {
  visibilityState: DocumentVisibilityState;
};

/** Headless autosave engine — also wrapped by the React hook. */
export function createRecentFlowAutosave(
  sessionId: string,
  doc: Y.Doc,
  flowName: string,
  options: {
    intervalMs?: number;
    save?: SaveRecentFlowFn;
    document?: VisibilityDocument;
    window?: LifecycleTarget;
  } = {},
): RecentFlowAutosave {
  const intervalMs = options.intervalMs ?? AUTOSAVE_INTERVAL_MS;
  const save = options.save ?? saveRecentFlow;
  const lifecycleDocument =
    options.document ?? (typeof document !== 'undefined' ? document : undefined);
  const lifecycleWindow = options.window ?? (typeof window !== 'undefined' ? window : undefined);

  let dirty = false;
  let destroyed = false;
  let flushing: Promise<void> | null = null;

  const maps = [
    nodesMap(doc),
    edgesMap(doc),
    contextMap(doc),
    layoutMap(doc),
    edgeLayoutMap(doc),
    metaMap(doc),
  ];

  const markDirty = () => {
    dirty = true;
  };

  for (const map of maps) {
    map.observeDeep(markDirty);
  }

  const flush = async (): Promise<void> => {
    if (destroyed || !dirty) return flushing ?? Promise.resolve();
    if (flushing) return flushing;
    flushing = (async () => {
      try {
        if (destroyed || !dirty) return;
        const bundle = serializeBundle(docToArtifact(doc));
        await save(sessionId, { name: flowName, bundle });
        dirty = false;
      } finally {
        flushing = null;
      }
    })();
    return flushing;
  };

  const onVisibilityChange = () => {
    if (lifecycleDocument?.visibilityState === 'hidden') {
      void flush();
    }
  };

  const onPageHide = () => {
    void flush();
  };

  const intervalId =
    typeof setInterval !== 'undefined'
      ? setInterval(() => {
          void flush();
        }, intervalMs)
      : null;

  lifecycleDocument?.addEventListener('visibilitychange', onVisibilityChange);
  lifecycleWindow?.addEventListener('pagehide', onPageHide);

  return {
    isDirty: () => dirty,
    flush,
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      if (intervalId !== null) clearInterval(intervalId);
      for (const map of maps) {
        map.unobserveDeep(markDirty);
      }
      lifecycleDocument?.removeEventListener('visibilitychange', onVisibilityChange);
      lifecycleWindow?.removeEventListener('pagehide', onPageHide);
    },
  };
}

export function useRecentFlowAutosave(sessionId: string, doc: Y.Doc, flowName: string): void {
  useEffect(() => {
    if (!sessionId) return;
    const autosave = createRecentFlowAutosave(sessionId, doc, flowName);
    return () => {
      void autosave.flush();
      autosave.destroy();
    };
  }, [sessionId, doc, flowName]);
}
