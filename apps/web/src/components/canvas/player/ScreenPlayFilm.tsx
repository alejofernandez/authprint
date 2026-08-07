'use client';

import type { Branding, ScreenNode } from '@authprint/dsl';
import { useMemo, useRef } from 'react';
import { ScreenMockup } from '../nodes/screen/ScreenMockup.tsx';
import { InteractionCursor } from './InteractionCursor.tsx';
import { planInteractionFilm, visibleFillValue } from './interactionFilm.ts';
import { useInteractionFilmClock } from './useInteractionFilmClock.ts';

/**
 * Play-mode screen with the FS-01 interaction film: moving cursor, invented
 * field fills on primary exits, then click the recorded action.
 */
export function ScreenPlayFilm({
  node,
  branding,
  errorBannerCopy,
  highlightedAction,
  highlightedActionLabel,
  secondaryActions,
  socialActions,
  playing,
  onFilmComplete,
  carryCursorFromPrior = false,
}: {
  node: ScreenNode;
  branding?: Branding;
  errorBannerCopy: string | null;
  highlightedAction: string | null;
  highlightedActionLabel: string | null;
  secondaryActions: readonly string[];
  socialActions: readonly string[];
  playing: boolean;
  onFilmComplete?: () => void;
  /** Later screens resume the hand from the prior film's last fingertip. */
  carryCursorFromPrior?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const plan = useMemo(
    () => planInteractionFilm(node, highlightedAction),
    [node, highlightedAction],
  );
  const clock = useInteractionFilmClock(plan?.ops ?? null, playing, onFilmComplete);

  const filmFieldValues = useMemo(() => {
    const map = new Map<string, string | boolean>();
    if (!plan || !clock) return map;
    for (const field of node.fields) {
      const full = plan.fieldValues[field.name];
      if (full === undefined) continue;
      if (clock.filledFields.has(field.name)) {
        map.set(field.name, full);
        continue;
      }
      if (clock.filling?.fieldName === field.name) {
        map.set(field.name, visibleFillValue(field, full, clock.filling.progress));
      }
    }
    return map;
  }, [plan, clock, node.fields]);

  return (
    <div ref={containerRef} className="relative">
      <ScreenMockup
        node={node}
        branding={branding}
        errorBannerCopy={errorBannerCopy}
        stageLayout="player"
        highlightedAction={highlightedAction}
        highlightedActionLabel={highlightedActionLabel}
        secondaryActions={secondaryActions}
        socialActions={socialActions}
        filmFieldValues={filmFieldValues}
      />
      <InteractionCursor
        containerRef={containerRef}
        targetId={clock?.cursorTargetId ?? null}
        clicking={Boolean(clock?.clickingTargetId)}
        moveProgress={clock?.moveProgress ?? null}
        carryFromPrior={carryCursorFromPrior}
        active={Boolean(plan)}
      />
    </div>
  );
}

export function screenStepHoldsAutoAdvance(nodeType: string, exitActionId: string | null): boolean {
  return nodeType === 'screen' && exitActionId !== null;
}
