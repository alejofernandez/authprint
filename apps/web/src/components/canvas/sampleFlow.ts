// Hand-built sample Flow exercising all six structural node types — used
// to drive the v0 read-only render in `Editor.tsx`. Replaced in E18 by
// real flows loaded from disk.

import type { Flow } from '@authprint/dsl';
import type { NodePositionsMap } from './flowToReactFlow.ts';

export const sampleFlow: Flow = {
  id: 'sample',
  name: 'Sample flow — every node type',
  theme: 'light',
  context: {
    'user.exists': { type: 'boolean' },
  },
  nodes: [
    { type: 'entry', id: 'e1' },
    {
      type: 'screen',
      id: 's1',
      name: 'Enter your email',
      kind: 'identifier-collect',
      traits: [],
      fields: [{ name: 'email', type: 'email', required: true }],
      fidelity: 'lo-fi',
    },
    {
      type: 'decision',
      id: 'd1',
      name: 'Account exists?',
      kind: 'user-exists',
      predicate: { slot: 'user.exists', op: 'equals', value: true },
    },
    {
      type: 'action',
      id: 'a1',
      name: 'Send sign-in code',
      kind: 'send-otp',
    },
    {
      type: 'external',
      id: 'x1',
      name: 'Continue with Google',
      kind: 'google',
    },
    {
      type: 'outcome',
      id: 'o-authenticated',
      name: 'Authenticated',
      kind: 'authenticated',
    },
    {
      type: 'outcome',
      id: 'o-abandoned',
      name: 'Abandoned',
      kind: 'abandoned',
    },
  ],
  edges: [
    {
      id: 'edge-1',
      source: 'e1',
      target: 's1',
      trigger: { type: 'unconditional' },
    },
    {
      id: 'edge-2',
      source: 's1',
      target: 'd1',
      trigger: { type: 'interaction', action: 'submit' },
    },
    {
      id: 'edge-3',
      source: 's1',
      target: 'x1',
      trigger: { type: 'interaction', action: 'google' },
    },
    {
      id: 'edge-4',
      source: 'd1',
      target: 'a1',
      trigger: { type: 'branch', value: true },
    },
    {
      id: 'edge-5',
      source: 'd1',
      target: 'o-abandoned',
      trigger: { type: 'branch', value: false },
    },
    {
      id: 'edge-6',
      source: 'a1',
      target: 'o-authenticated',
      trigger: { type: 'on-success' },
    },
    {
      id: 'edge-7',
      source: 'a1',
      target: 'o-abandoned',
      trigger: { type: 'on-error' },
    },
    {
      id: 'edge-8',
      source: 'x1',
      target: 'o-authenticated',
      trigger: { type: 'on-success' },
    },
    {
      id: 'edge-9',
      source: 'x1',
      target: 'o-abandoned',
      trigger: { type: 'on-error' },
    },
  ],
  annotations: [],
  scenarios: [],
};

// Hand-tuned positions until E17 wires elkjs auto-layout.
export const samplePositions: NodePositionsMap = {
  e1: { x: 400, y: 0 },
  s1: { x: 380, y: 140 },
  d1: { x: 380, y: 320 },
  a1: { x: 200, y: 500 },
  x1: { x: 600, y: 500 },
  'o-authenticated': { x: 400, y: 700 },
  'o-abandoned': { x: 100, y: 700 },
};
