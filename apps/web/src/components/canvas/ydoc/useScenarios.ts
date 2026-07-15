// Live scenario list for chrome outside FlowCanvas (US-120).
// scenariosMap mutations don't change the Y.Doc reference — mirror useFlowMeta.

import type { Scenario } from '@authprint/dsl';
import { useCallback, useRef, useSyncExternalStore } from 'react';
import type * as Y from 'yjs';
import { metaMap, readScenarios, scenariosMap } from './schema.ts';

export function useScenarios(doc: Y.Doc): Scenario[] {
  const cache = useRef<{ doc: Y.Doc; value: Scenario[] } | null>(null);

  const subscribe = useCallback(
    (onChange: () => void) => {
      const map = scenariosMap(doc);
      const meta = metaMap(doc);
      const handler = () => {
        cache.current = null;
        onChange();
      };
      map.observe(handler);
      meta.observe(handler);
      return () => {
        map.unobserve(handler);
        meta.unobserve(handler);
      };
    },
    [doc],
  );

  const getSnapshot = useCallback((): Scenario[] => {
    const value = readScenarios(doc);
    if (cache.current?.doc === doc && scenariosEqual(cache.current.value, value)) {
      return cache.current.value;
    }
    cache.current = { doc, value };
    return value;
  }, [doc]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function scenariosEqual(a: Scenario[], b: Scenario[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) return false;
  }
  return true;
}
