// Flow.branding.theme → resolved screen light/dark (US-070). Screen cards use the
// `flow-dark:` Tailwind variant (scoped to `.flow-theme-dark`) so they render
// independently of the editor's `.dark` class.

import type { FlowTheme } from '@authprint/dsl';
import type { Theme } from '@/components/theme';

export type ResolvedScreenTheme = 'light' | 'dark';

function resolveEditorTheme(editorTheme: Theme | 'light' | 'dark'): ResolvedScreenTheme {
  if (editorTheme === 'dark') return 'dark';
  if (editorTheme === 'light') return 'light';
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

/** Map Flow.branding.theme (+ editor theme when `both`) to the card's resolved appearance. */
export function resolveScreenTheme(
  flowTheme: FlowTheme,
  editorTheme: Theme | 'light' | 'dark',
): ResolvedScreenTheme {
  if (flowTheme === 'both') return resolveEditorTheme(editorTheme);
  return flowTheme;
}

export function screenThemeClass(resolved: ResolvedScreenTheme): string {
  return resolved === 'dark' ? 'flow-theme-dark' : 'flow-theme-light';
}
