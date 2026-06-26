// Pure helper for useElkLayout's return value (bundled-import blank-canvas fix).

import type { NodePositionsMap } from './flowToReactFlow.ts';

/** When every node is already in the layout map, elk is skipped — still return
 *  `{}` so callers can merge layout positions and render. */
export function elkLayoutReady(
  positions: NodePositionsMap | null,
  unplacedNodeIds: string,
): NodePositionsMap | null {
  if (unplacedNodeIds === '') return positions ?? {};
  return positions;
}
