'use client';

import type { Flow, Scenario } from '@authprint/dsl';
import { useEffect, useRef, useState } from 'react';
import {
  buildEditableScriptStep,
  hasSetPatch,
  scriptStepIndexForPlayerStep,
} from './editStepMapping.ts';
import { StepEditorPopover } from './StepEditorPopover.tsx';
import type { EditableScriptStep } from './stepEditorTypes.ts';
import type { PlayerStep } from './steps.ts';
import { GhostHeadClip, TimelineClip } from './TimelineClip.tsx';
import { TimelineProgressBar } from './TimelineProgressBar.tsx';
import { TIMELINE_CLIP_GAP } from './timelineGeometry.ts';

export type TimelineStripEditCallbacks = {
  onActionChange: (scriptStepIndex: number, action: string) => void;
  onResultChange: (
    scriptStepIndex: number,
    result: 'success' | 'error' | 'denied' | 'cancelled',
  ) => void;
  onSetPatchChange: (scriptStepIndex: number, slot: string, value: unknown | null) => void;
  onDeleteFromHere: (scriptStepIndex: number) => void;
};

type TimelineStripEditProps = {
  mode: 'edit';
  flow: Flow;
  draft: Scenario;
  ghostNextName?: string | null;
  editCallbacks: TimelineStripEditCallbacks;
};

export type TimelineStripProps = {
  steps: PlayerStep[];
  activeIndex: number;
  divergedIndex?: number | null;
  onSeek?: (index: number) => void;
  /** When false, the playhead does not auto-scroll into view (Storybook baselines). */
  autoScroll?: boolean;
  onScrubBegin?: () => void;
  onRevealOnCanvas?: (nodeId: string) => void;
  revealLabel?: string;
} & ({ mode?: 'view' } | TimelineStripEditProps);

export function TimelineStrip(props: TimelineStripProps) {
  const {
    steps,
    activeIndex,
    divergedIndex = null,
    onSeek,
    autoScroll = true,
    onScrubBegin,
    onRevealOnCanvas,
    revealLabel,
  } = props;
  const editProps: TimelineStripEditProps | null = props.mode === 'edit' ? props : null;

  const activeRef = useRef<HTMLDivElement>(null);
  const clipRefs = useRef(new Map<number, HTMLDivElement>());
  const [editor, setEditor] = useState<{
    anchor: { left: number; top: number; right: number; bottom: number };
    editable: EditableScriptStep | null;
    step: PlayerStep;
    draftId: string;
  } | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: activeIndex drives scroll-into-view when enabled
  useEffect(() => {
    if (!autoScroll) return;
    const el = activeRef.current;
    if (!el) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [activeIndex, autoScroll]);

  const seekTo = (index: number) => {
    onScrubBegin?.();
    onSeek?.(index);
  };

  const openEditor = (step: PlayerStep) => {
    if (!editProps) return;
    const el = clipRefs.current.get(step.index);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const editable = buildEditableScriptStep(editProps.flow, editProps.draft, steps, step.index);
    setEditor({
      anchor: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      editable,
      step,
      draftId: editProps.draft.id,
    });
  };

  const editorOpen = editProps && editor && editor.draftId === editProps.draft.id ? editor : null;

  return (
    <div className="w-full">
      <div className="overflow-x-auto overflow-y-visible pb-2" data-timeline-scroller>
        <div className="mx-auto w-max px-1.5">
          <TimelineProgressBar
            stepCount={steps.length}
            activeIndex={activeIndex}
            diverged={divergedIndex !== null && activeIndex === divergedIndex}
            onSeek={onSeek}
            onScrubBegin={onScrubBegin}
          />
          <div className="mb-1 flex" style={{ gap: TIMELINE_CLIP_GAP }}>
            {steps.map((step) => (
              <button
                key={`ruler-${step.nodeId}-${step.index}`}
                type="button"
                className="w-[120px] shrink-0 text-center text-[11px] text-fg-subtle hover:text-fg-muted"
                onClick={() => seekTo(step.index)}
              >
                {step.index + 1}
              </button>
            ))}
            {editProps?.ghostNextName ? (
              <span className="w-[120px] shrink-0 text-center text-[11px] text-fg-subtle">·</span>
            ) : null}
          </div>
          <div className="flex" style={{ gap: TIMELINE_CLIP_GAP }}>
            {steps.map((step) => {
              const active = step.index === activeIndex;
              const diverged = divergedIndex !== null && step.index === divergedIndex;
              const scriptIndex = editProps
                ? scriptStepIndexForPlayerStep(editProps.draft, steps, step.index)
                : null;
              const scripted = scriptIndex !== null;
              const patch =
                editProps && scriptIndex !== null
                  ? hasSetPatch(editProps.draft.inputScript[scriptIndex])
                  : false;

              return (
                <div
                  key={`clip-${step.nodeId}-${step.index}`}
                  ref={(el) => {
                    if (el) clipRefs.current.set(step.index, el);
                    else clipRefs.current.delete(step.index);
                    if (active) {
                      (activeRef as { current: HTMLDivElement | null }).current = el;
                    }
                  }}
                  className="shrink-0"
                >
                  {editProps ? (
                    <TimelineClip
                      mode="edit"
                      step={step}
                      active={active}
                      diverged={diverged}
                      scripted={scripted}
                      hasSetPatch={patch}
                      onEdit={() => openEditor(step)}
                      onRevealOnCanvas={
                        onRevealOnCanvas ? () => onRevealOnCanvas(step.nodeId) : undefined
                      }
                      revealLabel={revealLabel}
                    />
                  ) : (
                    <TimelineClip
                      step={step}
                      active={active}
                      diverged={diverged}
                      onSeek={onSeek ? () => seekTo(step.index) : undefined}
                      onRevealOnCanvas={
                        onRevealOnCanvas ? () => onRevealOnCanvas(step.nodeId) : undefined
                      }
                      revealLabel={revealLabel}
                    />
                  )}
                </div>
              );
            })}
            {editProps?.ghostNextName ? (
              <div className="shrink-0">
                <GhostHeadClip nextDisplayName={editProps.ghostNextName} />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {editorOpen && editProps ? (
        <StepEditorPopover
          contextSlots={editProps.flow.context}
          anchor={editorOpen.anchor}
          onClose={() => setEditor(null)}
          {...(editorOpen.editable
            ? {
                variant: 'scripted' as const,
                editable: editorOpen.editable,
                onActionChange: (action: string) => {
                  const idx = editorOpen.editable?.scriptStepIndex;
                  if (idx === undefined) return;
                  editProps.editCallbacks.onActionChange(idx, action);
                  setEditor(null);
                },
                onResultChange: (result: string) => {
                  const idx = editorOpen.editable?.scriptStepIndex;
                  if (idx === undefined) return;
                  editProps.editCallbacks.onResultChange(
                    idx,
                    result as 'success' | 'error' | 'denied' | 'cancelled',
                  );
                  setEditor(null);
                },
                onSetPatchChange: (slot: string, value: unknown | null) => {
                  const idx = editorOpen.editable?.scriptStepIndex;
                  if (idx === undefined) return;
                  editProps.editCallbacks.onSetPatchChange(idx, slot, value);
                },
                onDeleteFromHere: () => {
                  const idx = editorOpen.editable?.scriptStepIndex;
                  if (idx === undefined) return;
                  editProps.editCallbacks.onDeleteFromHere(idx);
                  setEditor(null);
                },
              }
            : { variant: 'derived' as const, step: editorOpen.step })}
        />
      ) : null}
    </div>
  );
}
