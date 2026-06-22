// Hand-built sample Flow exercising all six structural node types — used
// to drive the v0 read-only render in `Editor.tsx`. Replaced in E18 by
// real flows loaded from disk.
//
// Outcomes are deliberately DUPLICATED (3× abandoned, 2× authenticated)
// rather than shared — see REQUIREMENTS.md §7 "Visual cleanliness —
// diagrams should look clean". One shared outcome per kind would force
// crossing lines from multiple sources; duplication keeps each path
// reaching its own terminal node, no crossings.

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
      id: 'o-authenticated-otp',
      name: 'Authenticated',
      kind: 'authenticated',
    },
    {
      type: 'outcome',
      id: 'o-authenticated-google',
      name: 'Authenticated',
      kind: 'authenticated',
    },
    {
      type: 'outcome',
      id: 'o-abandoned-decline',
      name: 'Abandoned',
      kind: 'abandoned',
    },
    {
      type: 'outcome',
      id: 'o-abandoned-otp-error',
      name: 'Abandoned',
      kind: 'abandoned',
    },
    {
      type: 'outcome',
      id: 'o-abandoned-google-error',
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
      target: 'o-abandoned-decline',
      trigger: { type: 'branch', value: false },
    },
    {
      id: 'edge-6',
      source: 'a1',
      target: 'o-authenticated-otp',
      trigger: { type: 'on-success' },
    },
    {
      id: 'edge-7',
      source: 'a1',
      target: 'o-abandoned-otp-error',
      trigger: { type: 'on-error' },
    },
    {
      id: 'edge-8',
      source: 'x1',
      target: 'o-authenticated-google',
      trigger: { type: 'on-success' },
    },
    {
      id: 'edge-9',
      source: 'x1',
      target: 'o-abandoned-google-error',
      trigger: { type: 'on-error' },
    },
  ],
  annotations: [],
  scenarios: [],
};

// Hand-tuned LR positions until E17 wires elkjs auto-layout.
// Flow reads left-to-right: entry → screen → (decision | external) → outcomes.
export const samplePositions: NodePositionsMap = {
  e1: { x: 0, y: 320 },
  s1: { x: 160, y: 300 },
  d1: { x: 420, y: 200 },
  x1: { x: 420, y: 440 },
  a1: { x: 720, y: 200 },
  'o-abandoned-decline': { x: 720, y: 60 },
  'o-authenticated-otp': { x: 980, y: 180 },
  'o-abandoned-otp-error': { x: 980, y: 320 },
  'o-authenticated-google': { x: 720, y: 440 },
  'o-abandoned-google-error': { x: 720, y: 580 },
};
