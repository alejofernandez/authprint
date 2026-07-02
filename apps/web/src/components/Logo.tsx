'use client';

// The Authprint mark: two strokes meeting at an apex like a capital A, feet
// planted on an entry node (indigo) and an outcome node (emerald), crossbar
// standing in for a decision diamond (violet) — the product's own node
// vocabulary, drawn as the wordmark's initial. `outline` is the single-color
// chrome variant (topbar, favicon); `color` is the filled hero variant
// (About modal, start screen).

import { useId } from 'react';

const PATH_LEGS = 'M7 26 L16 6 L25 26';
const PATH_CROSSBAR = 'M10.6 18 L21.4 18';
const PATH_DIAMOND = 'M16 14.8 L19.2 18 L16 21.2 L12.8 18 Z';

export function Logo({
  variant = 'outline',
  size = 24,
  className,
}: {
  variant?: 'outline' | 'color';
  size?: number;
  className?: string;
}) {
  const gradientId = useId();

  if (variant === 'outline') {
    return (
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <path d={PATH_LEGS} />
        <path d={PATH_CROSSBAR} />
        <path d={PATH_DIAMOND} />
        <circle cx="7" cy="26" r="1.6" fill="currentColor" stroke="none" />
        <circle cx="25" cy="26" r="1.6" fill="currentColor" stroke="none" />
        <circle cx="16" cy="6" r="1.6" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <path
        d={PATH_LEGS}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d={PATH_CROSSBAR} stroke="#8b5cf6" strokeWidth={2.4} strokeLinecap="round" />
      <path d={PATH_DIAMOND} fill="#8b5cf6" />
      <circle cx="7" cy="26" r="2" fill="#6366f1" />
      <circle cx="25" cy="26" r="2" fill="#10b981" />
      <circle cx="16" cy="6" r="1.8" fill="#6366f1" />
    </svg>
  );
}
