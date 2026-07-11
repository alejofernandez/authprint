import type { Divergence } from '@authprint/dsl';

export function divergenceHeadline(divergence: Divergence): string {
  switch (divergence.kind) {
    case 'no-matching-edge':
      return 'No matching edge';
    case 'script-mismatch':
      return 'Script mismatch';
    case 'script-exhausted':
      return 'Script exhausted';
    case 'unknown-slot':
      return 'Unknown context slot';
    case 'predicate-type-error':
      return 'Predicate type error';
    case 'unexpected-outcome':
      return 'Unexpected outcome';
    case 'sequence-mismatch':
      return 'Sequence mismatch';
    case 'step-limit-exceeded':
      return 'Step limit exceeded';
  }
}

export function divergenceDetail(divergence: Divergence): string {
  switch (divergence.kind) {
    case 'no-matching-edge':
    case 'script-mismatch':
    case 'predicate-type-error':
      return divergence.detail;
    case 'script-exhausted':
      return `No script step for node '${divergence.nodeId}'`;
    case 'unknown-slot':
      return `Slot '${divergence.slot}' is not in context`;
    case 'unexpected-outcome':
      return `Expected '${divergence.expected}', reached '${divergence.actual}'`;
    case 'sequence-mismatch':
      return `At step ${divergence.atIndex + 1}: expected '${divergence.expected}', got '${divergence.actual}'`;
    case 'step-limit-exceeded':
      return `Walk exceeded safe step limit at '${divergence.nodeId}'`;
  }
}
