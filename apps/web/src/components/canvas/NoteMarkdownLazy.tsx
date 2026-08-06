'use client';

import dynamic from 'next/dynamic';
import type { NoteMarkdownProps } from './NoteMarkdown.tsx';

/**
 * Lazy entry for surfaces that must not pull react-markdown into the canvas
 * bundle (inspector + scenario stage). Stories and unit tests import
 * `NoteMarkdown` directly.
 */
export const NoteMarkdownLazy = dynamic(
  () => import('./NoteMarkdown.tsx').then((m) => m.NoteMarkdown),
  { ssr: false, loading: () => null },
);

export type { NoteMarkdownProps };
