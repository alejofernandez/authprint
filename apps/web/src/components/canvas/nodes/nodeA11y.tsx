'use client';

// Keyboard activation + focus styling for canvas nodes (US-077).

import type { Diagnostic } from '@authprint/dsl';
import { createContext, type KeyboardEvent, type ReactNode, useContext } from 'react';
import { CONNECT_ROLE_CLASS, useConnectRole } from './connectMode.tsx';
import { validationTitle } from './nodeValidation.ts';

/** Visible focus ring for tabbable canvas chrome (nodes, handle `+`). */
export const NODE_FOCUS_VISIBLE =
  'outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-canvas';

export const HANDLE_PLUS_FOCUS_VISIBLE =
  'outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-1';

const NodeActivateContext = createContext<((nodeId: string) => void) | null>(null);

export const NodeActivateProvider = NodeActivateContext.Provider;

function useNodeActivate(): ((nodeId: string) => void) | null {
  return useContext(NodeActivateContext);
}

export function CanvasNodeRoot({
  nodeId,
  ariaLabel,
  title,
  className,
  children,
}: {
  nodeId: string;
  ariaLabel: string;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  const activate = useNodeActivate();
  const connect = useConnectRole(nodeId);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    // Only when the node shell itself has focus. Keydowns bubble here from the
    // controls nested inside a node — the per-handle `+` above all — and this
    // handler used to preventDefault them, which silently cancelled the button's
    // own activation. That made the `+` unreachable by keyboard: Enter on it
    // opened the inspector instead of the type picker (found by US-137, whose
    // keyboard path starts at exactly that button).
    if (event.target !== event.currentTarget) return;
    // In target-pick mode Enter picks the target instead of opening the
    // inspector — the same key, the mode decides what it means.
    if (connect) {
      if (connect.role !== 'candidate') return;
      event.preventDefault();
      event.stopPropagation();
      connect.pick();
      return;
    }
    if (!activate) return;
    event.preventDefault();
    event.stopPropagation();
    activate(nodeId);
  };

  // Blocked nodes leave the tab order so Tab walks only real candidates, which
  // is what makes the mode keyboard-operable rather than merely keyboard-visible.
  const tabIndex = connect && connect.role !== 'candidate' ? -1 : 0;

  return (
    // biome-ignore lint/a11y/useSemanticElements: React Flow node shell — div keeps handle layout; keyboard-reachable via tabIndex.
    <div
      role="button"
      tabIndex={tabIndex}
      aria-label={ariaLabel}
      aria-disabled={connect?.role === 'blocked' || undefined}
      title={title}
      className={`${className ?? ''} ${NODE_FOCUS_VISIBLE} ${connect ? CONNECT_ROLE_CLASS[connect.role] : ''}`}
      onKeyDown={onKeyDown}
      onClickCapture={
        connect
          ? (event) => {
              // Capture, not bubble: a candidate's inner mockup buttons must not
              // swallow the pick, and a blocked node must not fall through to
              // React Flow's selection handling either.
              event.preventDefault();
              event.stopPropagation();
              if (connect.role === 'candidate') connect.pick();
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

/** Non-color validation cue: icon badge paired with the colored error/warning
 *  ring. Renders nothing for `info`-only diagnostics — they get no ring, so a
 *  badge would be a cue for a cue that isn't there (US-043). */
export function ValidationCue({ diagnostics }: { diagnostics?: Diagnostic[] }) {
  if (!diagnostics || diagnostics.length === 0) return null;
  const isError = diagnostics.some((d) => d.severity === 'error');
  const isWarning = diagnostics.some((d) => d.severity === 'warning');
  if (!isError && !isWarning) return null;
  return (
    <span
      className="pointer-events-none absolute top-0 right-0 z-20 flex h-4 w-4 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-bg-panel text-[10px] leading-none shadow-sm"
      aria-hidden
      title={validationTitle(diagnostics)}
    >
      {isError ? '⛔' : '⚠️'}
    </span>
  );
}
