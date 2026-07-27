import { describe, expect, test } from 'bun:test';
import { FlowSchema } from '@authprint/dsl';
import { screenActions } from './screenActions.ts';

const flow = FlowSchema.parse({
  id: 'f1',
  name: 'X',
  nodes: [
    { type: 'entry', id: 'e1' },
    { type: 'screen', id: 's1', name: 'OTP', kind: 'mfa-challenge' },
    { type: 'action', id: 'a1', name: 'Verify code', kind: 'verify-otp' },
    { type: 'action', id: 'a2', name: 'Resend', kind: 'send-otp' },
    { type: 'screen', id: 's2', name: 'Back home', kind: 'identifier-collect' },
  ],
  edges: [
    { id: 'edge-1', source: 'e1', target: 's1', trigger: { type: 'unconditional' } },
    {
      id: 'edge-2',
      source: 's1',
      target: 'a1',
      trigger: { type: 'interaction', action: 'submit' },
    },
    {
      id: 'edge-3',
      source: 's1',
      target: 'a2',
      trigger: { type: 'interaction', action: 'resend-code' },
    },
    {
      id: 'edge-4',
      source: 's1',
      target: 's2',
      trigger: { type: 'interaction', action: 'back' },
    },
  ],
});

describe('screenActions', () => {
  test('returns interaction actions in graph order with prominence', () => {
    expect(screenActions(flow, 's1')).toEqual([
      {
        action: 'submit',
        edgeId: 'edge-2',
        targetId: 'a1',
        targetName: 'Verify code',
        prominence: 'primary',
      },
      {
        action: 'resend-code',
        edgeId: 'edge-3',
        targetId: 'a2',
        targetName: 'Resend',
        prominence: 'secondary',
      },
      {
        action: 'back',
        edgeId: 'edge-4',
        targetId: 's2',
        targetName: 'Back home',
        prominence: 'secondary',
      },
    ]);
  });

  test('returns empty for unknown screen or screen with no exits', () => {
    expect(screenActions(flow, 'missing')).toEqual([]);
    expect(screenActions(flow, 's2')).toEqual([]);
  });
});
