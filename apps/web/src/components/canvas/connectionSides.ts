// Geometric connection-side overrides (US-113). Semantics stay on triggers;
// sides are view state in the layout layer. Handle ids for side-only handles
// are prefixed so creation paths (triggerFor) never treat them as semantic.

import type { Node as DslNode, Trigger } from '@authprint/dsl';
import { sourceHandleFor } from './flowToReactFlow.ts';
import type { ConnectionSide, EdgeLayoutRecord } from './ydoc/schema.ts';

export const GEO_SOURCE_TOP = 'top-out';
export const GEO_SOURCE_BOTTOM = 'bottom-out';
export const GEO_SOURCE_RIGHT = 'right-out';
export const GEO_TARGET_TOP = 'top-in';
export const GEO_TARGET_BOTTOM = 'bottom-in';

const DECISION_GEO_SOURCE_HANDLES = new Set([GEO_SOURCE_TOP, GEO_SOURCE_BOTTOM, GEO_SOURCE_RIGHT]);

const SOURCE_BOTTOM_HANDLES = new Set(['false', 'alt', 'on-error']);

export function isGeometricSourceHandle(
  nodeType: DslNode['type'],
  handleId: string | null | undefined,
): boolean {
  return nodeType === 'decision' && DECISION_GEO_SOURCE_HANDLES.has(handleId ?? '');
}

export function isGeometricTargetHandle(
  nodeType: DslNode['type'],
  handleId: string | null | undefined,
): boolean {
  return (
    (nodeType === 'outcome' || nodeType === 'external') &&
    (handleId === GEO_TARGET_TOP || handleId === GEO_TARGET_BOTTOM)
  );
}

export function isSideRelocationSourceHandle(
  nodeType: DslNode['type'],
  handleId: string | null | undefined,
): boolean {
  if (isGeometricSourceHandle(nodeType, handleId)) return true;
  if (nodeType !== 'decision') return false;
  return handleId === 'true' || handleId === 'false';
}

export function isSideRelocationTargetHandle(
  nodeType: DslNode['type'],
  handleId: string | null | undefined,
): boolean {
  if (isGeometricTargetHandle(nodeType, handleId)) return true;
  if (nodeType !== 'outcome' && nodeType !== 'external') return false;
  return handleId === null || handleId === undefined;
}

export function sourceHandleToSide(handleId: string | null | undefined): ConnectionSide {
  if (handleId === GEO_SOURCE_TOP) return 'top';
  if (handleId === GEO_SOURCE_BOTTOM) return 'bottom';
  if (handleId === GEO_SOURCE_RIGHT) return 'right';
  if (handleId && SOURCE_BOTTOM_HANDLES.has(handleId)) return 'bottom';
  return 'right';
}

export function targetHandleToSide(handleId: string | null | undefined): ConnectionSide {
  if (handleId === GEO_TARGET_TOP) return 'top';
  if (handleId === GEO_TARGET_BOTTOM) return 'bottom';
  return 'left';
}

export function defaultSourceSide(trigger: Trigger): ConnectionSide {
  return sourceHandleToSide(sourceHandleFor(trigger));
}

export function defaultTargetSide(): ConnectionSide {
  return 'left';
}

export function effectiveSourceHandle(
  nodeType: DslNode['type'],
  trigger: Trigger,
  layout?: EdgeLayoutRecord,
): string | undefined {
  const side = layout?.sourceSide ?? defaultSourceSide(trigger);
  if (nodeType === 'decision' && side === 'top') return GEO_SOURCE_TOP;
  if (side === 'bottom') {
    const semantic = sourceHandleFor(trigger);
    if (semantic && sourceHandleToSide(semantic) === 'bottom') return semantic;
    if (nodeType === 'decision') return GEO_SOURCE_BOTTOM;
    if (nodeType === 'screen') return 'alt';
    if (nodeType === 'action' || nodeType === 'external') return 'on-error';
  }
  if (side === 'right') {
    const semantic = sourceHandleFor(trigger);
    if (semantic && sourceHandleToSide(semantic) === 'right') return semantic;
    if (nodeType === 'decision') return GEO_SOURCE_RIGHT;
    if (nodeType === 'screen') return 'default';
    if (nodeType === 'action' || nodeType === 'external') return 'on-success';
    return undefined;
  }
  return sourceHandleFor(trigger);
}

export function effectiveTargetHandle(
  nodeType: DslNode['type'],
  layout?: EdgeLayoutRecord,
): string | undefined {
  const side = layout?.targetSide ?? defaultTargetSide();
  if (nodeType === 'outcome' || nodeType === 'external') {
    if (side === 'top') return GEO_TARGET_TOP;
    if (side === 'bottom') return GEO_TARGET_BOTTOM;
  }
  return undefined;
}

export function sourceSideFromReconnect(
  nodeType: DslNode['type'],
  _trigger: Trigger,
  handleId: string | null | undefined,
): ConnectionSide | undefined {
  if (!isSideRelocationSourceHandle(nodeType, handleId)) return undefined;
  return sourceHandleToSide(handleId);
}

export function targetSideFromReconnect(
  nodeType: DslNode['type'],
  handleId: string | null | undefined,
): ConnectionSide | undefined {
  if (!isSideRelocationTargetHandle(nodeType, handleId)) return undefined;
  return targetHandleToSide(handleId);
}

export function normalizeSideOverride(
  side: ConnectionSide,
  defaultSide: ConnectionSide,
): ConnectionSide | undefined {
  return side === defaultSide ? undefined : side;
}

// ─── Decision node affordances (US-113) ──────────────────────────────────────
// Semantic handles (`true` / `false`) map to yes/no triggers. Geometric handles
// (`top-out`, `right-out`, `bottom-out`) share sides but avoid id collisions
// when a branch exits off its default side. `connectedHandles` tracks which
// physical handle ids carry an edge; `usedDecisionBranches` tracks yes/no slots.
//
// When extending this path (US-114+, other node types):
// - Map side → handle id in effectiveSourceHandle; keep node views declarative.
// - Wire every new handle through resolveCreateFromHandle (create.ts) and tests.
// - Do not render a geometric handle on a side while the free semantic handle
//   is still shown — overlapping ids break drag-connect hit targets.
// - If affordance rules outgrow the switch below, prefer a table-driven config
//   over more one-off conditionals. See AGENTS.md gotchas (connection sides).

function rightSideOccupied(connected?: ReadonlySet<string>): boolean {
  if (!connected) return false;
  return connected.has('true') || connected.has(GEO_SOURCE_RIGHT);
}

function bottomSideOccupied(connected?: ReadonlySet<string>): boolean {
  if (!connected) return false;
  return connected.has('false') || connected.has(GEO_SOURCE_BOTTOM);
}

/** Should the per-handle `+` show for this decision source handle? */
export function decisionHandlePlusVisible(
  handleId: string,
  connected?: ReadonlySet<string>,
  used?: ReadonlySet<'yes' | 'no'>,
): boolean {
  if (connected?.has(handleId)) return false;
  if (handleId === 'true' && rightSideOccupied(connected)) return false;
  if (handleId === GEO_SOURCE_RIGHT && rightSideOccupied(connected)) return false;
  if (handleId === 'false' && connected?.has('false')) return false;
  if (handleId === GEO_SOURCE_BOTTOM && bottomSideOccupied(connected)) return false;

  const yesOpen = !used?.has('yes');
  const noOpen = !used?.has('no');
  if (!yesOpen && !noOpen) return false;

  switch (handleId) {
    case 'true':
      return yesOpen;
    case 'false':
      return noOpen;
    case GEO_SOURCE_TOP:
    case GEO_SOURCE_BOTTOM:
    case GEO_SOURCE_RIGHT:
      return yesOpen || noOpen;
    default:
      return false;
  }
}

/** Should an extra geometric handle render (never stacked on a free semantic one)? */
export function decisionGeometricHandleVisible(
  handleId: string,
  connected?: ReadonlySet<string>,
  used?: ReadonlySet<'yes' | 'no'>,
): boolean {
  if (handleId === GEO_SOURCE_RIGHT) {
    if (rightSideOccupied(connected)) return false;
    if (decisionHandlePlusVisible('true', connected, used)) return false;
  }
  if (handleId === GEO_SOURCE_BOTTOM) {
    if (bottomSideOccupied(connected)) return false;
    if (decisionHandlePlusVisible('false', connected, used)) return false;
  }
  return decisionHandlePlusVisible(handleId, connected, used);
}
