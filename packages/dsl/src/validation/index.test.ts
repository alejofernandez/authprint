import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from '../parser/index.ts';
import { FlowSchema } from '../schema/flow.ts';
import { canExport, validate } from './index.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

describe('validate — orchestrator', () => {
  test('passkey-enrollment example: zero errors, zero warnings', () => {
    const text = readFileSync(
      `${here}/../../../dsl-spec/examples/passkey-enrollment.authprint`,
      'utf8',
    );
    const parsed = parse(text);
    expect(parsed.flow).not.toBeNull();
    if (!parsed.flow) return;

    const diagnostics = validate(parsed.flow);
    expect(diagnostics).toEqual([]);
    expect(canExport(parsed.flow)).toBe(true);
  });

  test('magic-link-signin example: zero errors, zero warnings', () => {
    const text = readFileSync(
      `${here}/../../../dsl-spec/examples/magic-link-signin.authprint`,
      'utf8',
    );
    const parsed = parse(text);
    expect(parsed.flow).not.toBeNull();
    if (!parsed.flow) return;

    const diagnostics = validate(parsed.flow);
    expect(diagnostics).toEqual([]);
    expect(canExport(parsed.flow)).toBe(true);
  });

  test('warning-only flow: canExport true', () => {
    // Custom (unknown) kind triggers a vocabulary warning but no errors.
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      nodes: [
        { type: 'entry', id: 'e1' },
        {
          type: 'screen',
          id: 's1',
          name: 'Hello',
          kind: 'totally-custom-screen-kind',
        },
        { type: 'outcome', id: 'o1', name: 'Done', kind: 'authenticated' },
      ],
      edges: [
        { id: 'edge-1', source: 'e1', target: 's1', trigger: { type: 'unconditional' } },
        {
          id: 'edge-2',
          source: 's1',
          target: 'o1',
          trigger: { type: 'interaction', action: 'submit' },
        },
      ],
    });
    const diagnostics = validate(flow);
    // Should have a warning but no errors.
    expect(diagnostics.some((d) => d.severity === 'warning')).toBe(true);
    expect(diagnostics.some((d) => d.severity === 'error')).toBe(false);
    expect(canExport(flow)).toBe(true);
  });

  test('error-containing flow: canExport false', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      nodes: [], // no entry → error
    });
    const diagnostics = validate(flow);
    expect(diagnostics.some((d) => d.code === 'validation-entry-missing')).toBe(true);
    expect(canExport(flow)).toBe(false);
  });

  test('diagnostics sorted deterministically (errors before warnings)', () => {
    // Flow with both an error (entry missing) and a vocabulary warning.
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      nodes: [
        { type: 'screen', id: 's1', name: 'A', kind: 'custom-kind' },
        { type: 'outcome', id: 'o1', name: 'B', kind: 'authenticated' },
      ],
    });
    const diagnostics = validate(flow);
    const severities = diagnostics.map((d) => d.severity);
    // All errors come before all warnings.
    const firstWarningIdx = severities.indexOf('warning');
    const lastErrorIdx = severities.lastIndexOf('error');
    if (firstWarningIdx !== -1 && lastErrorIdx !== -1) {
      expect(lastErrorIdx).toBeLessThan(firstWarningIdx);
    }
  });

  test('kitchen sink: a deliberately broken flow surfaces multiple validation codes', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'Broken',
      context: { 'x.y': { type: 'boolean' } },
      nodes: [
        // No entry
        { type: 'action', id: 'a1', name: 'X', kind: 'send-otp' },
        {
          type: 'decision',
          id: 'd1',
          kind: 'user-exists',
          predicate: { slot: 'nonexistent', op: 'equals', value: true },
        },
        // Orphan outcome
        { type: 'outcome', id: 'o1', name: 'A', kind: 'authenticated' },
      ],
      edges: [
        // Action with no success/error edges → missing-success + missing-error
        // Edge with bad target reference
        { id: 'edge-bad', source: 'a1', target: 'ghost', trigger: { type: 'on-success' } },
      ],
    });
    const codes = new Set(validate(flow).map((d) => d.code));

    // Verify a variety of codes fire on the same flow.
    expect(codes.has('validation-entry-missing')).toBe(true);
    expect(codes.has('validation-action-missing-error-edge')).toBe(true);
    expect(codes.has('validation-edge-target-not-found')).toBe(true);
    expect(codes.has('validation-predicate-slot-undeclared')).toBe(true);
    expect(canExport(flow)).toBe(false);
  });
});
