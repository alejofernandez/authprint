import { describe, expect, test } from 'bun:test';
import { FlowSchema } from '../schema/flow.ts';
import { checkContextIntegrity } from './context.ts';

describe('checkContextIntegrity — decision predicates', () => {
  test('valid predicate → no diagnostics', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      context: { 'risk.score': { type: 'number' } },
      nodes: [
        { type: 'entry', id: 'e1' },
        {
          type: 'decision',
          id: 'd1',
          kind: 'risk-elevated',
          predicate: { slot: 'risk.score', op: 'greater-than', value: 50 },
        },
      ],
    });
    expect(checkContextIntegrity(flow)).toEqual([]);
  });

  test('undeclared slot → slot-undeclared error', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      context: {},
      nodes: [
        { type: 'entry', id: 'e1' },
        {
          type: 'decision',
          id: 'd1',
          kind: 'risk-elevated',
          predicate: { slot: 'nonexistent', op: 'equals', value: true },
        },
      ],
    });
    const codes = checkContextIntegrity(flow).map((d) => d.code);
    expect(codes).toContain('validation-predicate-slot-undeclared');
  });

  test('op incompatible with slot type → op-incompatible error', () => {
    // greater-than on a boolean slot is invalid
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      context: { 'x.y': { type: 'boolean' } },
      nodes: [
        { type: 'entry', id: 'e1' },
        {
          type: 'decision',
          id: 'd1',
          kind: 'user-exists',
          predicate: { slot: 'x.y', op: 'greater-than', value: true },
        },
      ],
    });
    const codes = checkContextIntegrity(flow).map((d) => d.code);
    expect(codes).toContain('validation-predicate-op-incompatible');
  });

  test('value type mismatch → value-type-mismatch error', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      context: { 'x.y': { type: 'boolean' } },
      nodes: [
        { type: 'entry', id: 'e1' },
        {
          type: 'decision',
          id: 'd1',
          kind: 'user-exists',
          predicate: { slot: 'x.y', op: 'equals', value: 'not-a-boolean' },
        },
      ],
    });
    const codes = checkContextIntegrity(flow).map((d) => d.code);
    expect(codes).toContain('validation-predicate-value-type-mismatch');
  });

  test('in op with array value of correct types → no diagnostics', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      context: { 'device.type': { type: 'enum', values: ['mobile', 'desktop', 'tablet'] } },
      nodes: [
        { type: 'entry', id: 'e1' },
        {
          type: 'decision',
          id: 'd1',
          kind: 'device-known',
          predicate: { slot: 'device.type', op: 'in', value: ['mobile', 'tablet'] },
        },
      ],
    });
    expect(checkContextIntegrity(flow)).toEqual([]);
  });

  test('in op with non-array value → value-type-mismatch error', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      context: { 'device.type': { type: 'enum', values: ['mobile', 'desktop'] } },
      nodes: [
        { type: 'entry', id: 'e1' },
        {
          type: 'decision',
          id: 'd1',
          kind: 'device-known',
          predicate: { slot: 'device.type', op: 'in', value: 'mobile' },
        },
      ],
    });
    const codes = checkContextIntegrity(flow).map((d) => d.code);
    expect(codes).toContain('validation-predicate-value-type-mismatch');
  });
});

describe('checkContextIntegrity — scenario initialContext', () => {
  test('valid scenario context → no diagnostics', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      context: {
        'user.has_passkey': { type: 'boolean' },
        'risk.score': { type: 'number' },
      },
      nodes: [{ type: 'entry', id: 'e1' }],
      scenarios: [
        {
          id: 'sc1',
          name: 'X',
          initialContext: { 'user.has_passkey': true, 'risk.score': 25 },
          inputScript: [],
        },
      ],
    });
    expect(checkContextIntegrity(flow)).toEqual([]);
  });

  test('scenario references undeclared slot → context-slot-undeclared error', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      context: { 'user.has_passkey': { type: 'boolean' } },
      nodes: [{ type: 'entry', id: 'e1' }],
      scenarios: [
        {
          id: 'sc1',
          name: 'X',
          initialContext: { 'unknown.slot': true },
          inputScript: [],
        },
      ],
    });
    const codes = checkContextIntegrity(flow).map((d) => d.code);
    expect(codes).toContain('validation-scenario-context-slot-undeclared');
  });

  test('scenario value wrong type → context-value-type-mismatch error', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      context: { 'risk.score': { type: 'number' } },
      nodes: [{ type: 'entry', id: 'e1' }],
      scenarios: [
        {
          id: 'sc1',
          name: 'X',
          initialContext: { 'risk.score': 'high' }, // string instead of number
          inputScript: [],
        },
      ],
    });
    const codes = checkContextIntegrity(flow).map((d) => d.code);
    expect(codes).toContain('validation-scenario-context-value-type-mismatch');
  });
});
