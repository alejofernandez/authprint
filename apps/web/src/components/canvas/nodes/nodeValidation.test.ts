import { describe, expect, test } from 'bun:test';
import type { Diagnostic } from '@authprint/dsl';
import { validationRing, validationTitle } from './nodeValidation.ts';

const diag = (severity: Diagnostic['severity'], message: string): Diagnostic => ({
  severity,
  code: 'vocabulary-unknown-screen-kind',
  message,
  target: { kind: 'node', id: 'n1' },
});

describe('validationRing — severity drives the canvas cue', () => {
  test('error rings red', () => {
    expect(validationRing([diag('error', 'boom')])).toContain('signal-danger-ring');
  });

  test('warning rings amber', () => {
    expect(validationRing([diag('warning', 'hmm')])).toContain('signal-warning-ring');
  });

  // The point of the `info` level: a value the tool accepts must not decorate
  // the node. Users reported the custom-kind warning as a false alarm twice
  // (UF-005, then UF-043).
  test('info gets no ring at all', () => {
    expect(validationRing([diag('info', 'custom kind')])).toBe('');
  });

  test('info alongside a real problem does not suppress that problem', () => {
    expect(validationRing([diag('info', 'custom kind'), diag('error', 'boom')])).toContain(
      'signal-danger-ring',
    );
    expect(validationRing([diag('info', 'custom kind'), diag('warning', 'hmm')])).toContain(
      'signal-warning-ring',
    );
  });

  // US-133 invites free placement; both connectivity errors stay errors in
  // Problems, but the canvas must not shout "broken" at a node we just asked the
  // user to drop. Note the pair: dropping a node raises BOTH codes, so testing
  // either one alone would pass while the real node still rings red.
  const connectivity = (code: Diagnostic['code'], message: string): Diagnostic => ({
    severity: 'error',
    code,
    message,
    target: { kind: 'node', id: 'n1' },
  });
  const justDropped = [
    connectivity('validation-unreachable-node', "node 'n1' is not reachable from entry"),
    connectivity('validation-non-terminable-node', "node 'n1' cannot reach any outcome"),
  ];

  test('a just-placed node gets the soft unwired ring, not danger', () => {
    const ring = validationRing(justDropped, true);
    expect(ring).toContain('ring-border-default');
    expect(ring).not.toContain('signal-danger-ring');
  });

  test('the same codes on a wired node stay danger — a dead end is real', () => {
    expect(validationRing(justDropped, false)).toContain('signal-danger-ring');
  });

  test('being unwired does not mute an unrelated error on the same node', () => {
    expect(validationRing([...justDropped, diag('error', 'boom')], true)).toContain(
      'signal-danger-ring',
    );
  });
});

describe('validationTitle — everything stays discoverable', () => {
  test('info still appears in the tooltip, with its own glyph', () => {
    const title = validationTitle([diag('info', 'custom kind')]);
    expect(title).toBe('ℹ️ custom kind');
  });

  test('mixed severities all listed', () => {
    const title = validationTitle([diag('error', 'boom'), diag('info', 'custom kind')]);
    expect(title).toBe('⛔ boom\nℹ️ custom kind');
  });
});
