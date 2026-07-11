import type { Node } from '@authprint/dsl';
import type { PlayerStep } from './steps.ts';

/** Timeline clip surface colors aligned with canvas node identity tokens. */
export function clipToneClasses(nodeType: PlayerStep['nodeType']): string {
  switch (nodeType) {
    case 'decision':
      return 'border-node-decision-border bg-node-decision-bg text-node-decision-fg';
    case 'action':
    case 'external':
      return 'border-accent-primary-border-muted bg-accent-primary-bg text-accent-primary-fg';
    case 'outcome':
      return 'border-node-outcome-success-border bg-node-outcome-success-bg text-node-outcome-success-fg';
    case 'screen':
      return 'border-border-default bg-bg-panel text-fg-default';
    case 'entry':
      return 'border-border-subtle bg-bg-subtle text-fg-subtle';
  }
}

export function structuralTypeLabel(nodeType: PlayerStep['nodeType']): string {
  return nodeType;
}

export function isWarmOutcomeKind(kind: string): boolean {
  return kind === 'abandoned' || kind === 'error' || kind.includes('error');
}

export function nodeKindLabel(node: Node): string | null {
  if ('kind' in node && node.kind) return node.kind;
  return null;
}
