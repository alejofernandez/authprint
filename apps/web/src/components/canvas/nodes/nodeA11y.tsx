'use client';

// Keyboard activation + focus styling for canvas nodes (US-077).

import type { Diagnostic } from '@authprint/dsl';
import { createContext, type KeyboardEvent, type ReactNode, useContext } from 'react';
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

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!activate || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    event.stopPropagation();
    activate(nodeId);
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: React Flow node shell — div keeps handle layout; keyboard-reachable via tabIndex.
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      title={title}
      className={`${className ?? ''} ${NODE_FOCUS_VISIBLE}`}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}

/** Non-color validation cue: icon badge paired with the colored error/warning ring. */
export function ValidationCue({ diagnostics }: { diagnostics?: Diagnostic[] }) {
  if (!diagnostics || diagnostics.length === 0) return null;
  const isError = diagnostics.some((d) => d.severity === 'error');
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
