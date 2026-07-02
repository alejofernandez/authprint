// Live flow-level meta (name, branding) for chrome that sits outside FlowCanvas.
// metaMap mutations don't change the Y.Doc reference, so a plain useMemo on
// `doc` would go stale — same useSyncExternalStore pattern as useYDocFlow.

import type { Flow } from '@authprint/dsl';
import { useCallback, useRef, useSyncExternalStore } from 'react';
import type * as Y from 'yjs';
import { metaMap } from './schema.ts';

export type FlowMetaView = { name: string; branding: Flow['branding'] };

function readMeta(doc: Y.Doc): FlowMetaView {
  const meta = metaMap(doc);
  return {
    name: meta.get('name') as string,
    branding: meta.get('branding') as Flow['branding'],
  };
}

export function useFlowMeta(doc: Y.Doc): FlowMetaView {
  const cache = useRef<{ doc: Y.Doc; value: FlowMetaView } | null>(null);

  const subscribe = useCallback(
    (onChange: () => void) => {
      const meta = metaMap(doc);
      const handler = () => {
        cache.current = null;
        onChange();
      };
      meta.observe(handler);
      return () => meta.unobserve(handler);
    },
    [doc],
  );

  const getSnapshot = useCallback((): FlowMetaView => {
    const value = readMeta(doc);
    if (
      cache.current?.doc === doc &&
      cache.current.value.name === value.name &&
      cache.current.value.branding?.theme === value.branding?.theme &&
      cache.current.value.branding?.companyName === value.branding?.companyName &&
      cache.current.value.branding?.primaryColor === value.branding?.primaryColor
    ) {
      return cache.current.value;
    }
    cache.current = { doc, value };
    return value;
  }, [doc]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
