import { describe, expect, test } from 'bun:test';
import type { Node as DslNode, Edge } from '@authprint/dsl';
import { effectiveSourceHandle } from '../connectionSides.ts';
import { flowToReactFlow } from '../flowToReactFlow.ts';
import { hydrate, readFlow } from './hydrate.ts';
import {
  addEdge,
  addNode,
  declareContextSlot,
  incidentEdgeIds,
  moveNode,
  putScenario,
  removeEdge,
  removeNode,
  removeScenario,
  setCompanyName,
  setDecisionPredicate,
  setEdgeRoute,
  setEdgeSideOverrides,
  setEdgeTrigger,
  setFlowName,
  setFlowTheme,
  setNodeErrorMessage,
  setNodeKind,
  setNodeName,
  setPrimaryColor,
  setScreenDisplayErrorState,
  setScreenFidelity,
  setScreenFields,
  setScreenTraits,
  swapEdgeTriggers,
} from './ops.ts';
import {
  edgeLayoutMap,
  edgesMap,
  layoutMap,
  metaMap,
  nodesMap,
  readScenarioOrder,
  scenariosMap,
} from './schema.ts';

// Minimal flow: entry → screen → (decision) → outcome, decision has both branches.
function base() {
  return hydrate({
    id: 'f',
    name: 'F',
    branding: { theme: 'light' },
    context: { u: { type: 'boolean' } },
    nodes: [
      { type: 'entry', id: 'entry' },
      {
        type: 'screen',
        id: 's1',
        name: 'S',
        kind: 'identifier-collect',
        traits: [],
        fields: [],
        fidelity: 'lo-fi',
      },
      {
        type: 'decision',
        id: 'd1',
        kind: 'user-exists',
        predicate: { slot: 'u', op: 'equals', value: true },
      },
      { type: 'outcome', id: 'o1', name: 'Yes', kind: 'authenticated' },
      { type: 'outcome', id: 'o2', name: 'No', kind: 'denied' },
    ],
    edges: [
      { id: 'e1', source: 'entry', target: 's1', trigger: { type: 'unconditional' } },
      { id: 'e2', source: 's1', target: 'd1', trigger: { type: 'interaction', action: 'submit' } },
      { id: 'e3', source: 'd1', target: 'o1', trigger: { type: 'branch', value: true } },
      { id: 'e4', source: 'd1', target: 'o2', trigger: { type: 'branch', value: false } },
    ],
    annotations: [],
    scenarios: [],
  });
}

const newOutcome: DslNode = { type: 'outcome', id: 'o3', name: 'Err', kind: 'error' };

describe('addNode', () => {
  test('adds a node', () => {
    const doc = base();
    expect(addNode(doc, newOutcome)).toEqual({ ok: true });
    expect(nodesMap(doc).has('o3')).toBe(true);
  });
  test('rejects a duplicate id', () => {
    const doc = base();
    const r = addNode(doc, { ...newOutcome, id: 's1' });
    expect(r.ok).toBe(false);
  });
});

describe('removeNode', () => {
  test('cascades to incident edges, their routes, and the layout entry', () => {
    const doc = base();
    moveNode(doc, 'd1', { x: 10, y: 20 });
    setEdgeRoute(doc, 'e2', [{ x: 1, y: 2 }]);
    setEdgeRoute(doc, 'e3', [{ x: 3, y: 4 }]);
    expect(removeNode(doc, 'd1')).toEqual({ ok: true });
    expect(nodesMap(doc).has('d1')).toBe(false);
    expect(layoutMap(doc).has('d1')).toBe(false);
    expect(edgeLayoutMap(doc).has('e2')).toBe(false);
    expect(edgeLayoutMap(doc).has('e3')).toBe(false);
    expect(edgeLayoutMap(doc).has('e4')).toBe(false);
    // e2 (→d1), e3 (d1→), e4 (d1→) all gone; e1 (entry→s1) stays.
    expect([...edgesMap(doc).keys()].sort()).toEqual(['e1']);
  });
  test('is idempotent for an absent node', () => {
    const doc = base();
    expect(removeNode(doc, 'nope')).toEqual({ ok: true });
  });
});

describe('moveNode', () => {
  test('writes the layout entry', () => {
    const doc = base();
    expect(moveNode(doc, 's1', { x: 100, y: 200 })).toEqual({ ok: true });
    expect(layoutMap(doc).get('s1')).toEqual({ x: 100, y: 200 });
  });
  test('preserves displayErrorState when repositioning', () => {
    const doc = base();
    setScreenDisplayErrorState(doc, 's1', true, { x: 10, y: 20 });
    moveNode(doc, 's1', { x: 100, y: 200 });
    expect(layoutMap(doc).get('s1')).toEqual({ x: 100, y: 200, displayErrorState: true });
  });
  test('rejects an unknown node', () => {
    expect(moveNode(base(), 'nope', { x: 0, y: 0 }).ok).toBe(false);
  });
});

describe('setScreenDisplayErrorState', () => {
  test('sets and clears the layout preview flag on screens', () => {
    const doc = base();
    expect(setScreenDisplayErrorState(doc, 's1', true, { x: 50, y: 60 })).toEqual({ ok: true });
    expect(layoutMap(doc).get('s1')).toEqual({ x: 50, y: 60, displayErrorState: true });
    expect(setScreenDisplayErrorState(doc, 's1', false, { x: 50, y: 60 })).toEqual({ ok: true });
    expect(layoutMap(doc).get('s1')).toEqual({ x: 50, y: 60 });
  });

  test('preserves existing position when toggling', () => {
    const doc = base();
    moveNode(doc, 's1', { x: 10, y: 20 });
    setScreenDisplayErrorState(doc, 's1', true, { x: 999, y: 999 });
    expect(layoutMap(doc).get('s1')).toEqual({ x: 10, y: 20, displayErrorState: true });
  });

  test('rejects non-screen nodes', () => {
    expect(setScreenDisplayErrorState(base(), 'd1', true, { x: 0, y: 0 }).ok).toBe(false);
  });
});

describe('addEdge / removeEdge', () => {
  test('adds an edge between existing nodes', () => {
    const doc = base();
    const edge: Edge = {
      id: 'e5',
      source: 's1',
      target: 'o1',
      trigger: { type: 'interaction', action: 'back' },
    };
    expect(addEdge(doc, edge)).toEqual({ ok: true });
    expect(edgesMap(doc).has('e5')).toBe(true);
  });
  test('rejects an edge to a nonexistent target', () => {
    const r = addEdge(base(), {
      id: 'e9',
      source: 's1',
      target: 'ghost',
      trigger: { type: 'interaction', action: 'x' },
    });
    expect(r.ok).toBe(false);
  });
  test('rejects a duplicate edge id', () => {
    expect(
      addEdge(base(), {
        id: 'e1',
        source: 's1',
        target: 'o1',
        trigger: { type: 'interaction', action: 'x' },
      }).ok,
    ).toBe(false);
  });
  test('removeEdge deletes the edge and its route', () => {
    const doc = base();
    setEdgeRoute(doc, 'e3', [{ x: 10, y: 20 }]);
    expect(removeEdge(doc, 'e3')).toEqual({ ok: true });
    expect(edgesMap(doc).has('e3')).toBe(false);
    expect(edgeLayoutMap(doc).has('e3')).toBe(false);
  });
});

describe('setEdgeRoute', () => {
  test('writes a route for an existing edge', () => {
    const doc = base();
    const points = [
      { x: 100, y: 200 },
      { x: 150, y: 250 },
    ];
    expect(setEdgeRoute(doc, 'e2', points)).toEqual({ ok: true });
    expect(edgeLayoutMap(doc).get('e2')).toEqual({ points });
  });

  test('rejects an unknown edge', () => {
    expect(setEdgeRoute(base(), 'ghost', [{ x: 0, y: 0 }]).ok).toBe(false);
  });
});

describe('incidentEdgeIds', () => {
  test('finds edges touching a node on either end', () => {
    expect(incidentEdgeIds(base(), 'd1').sort()).toEqual(['e2', 'e3', 'e4']);
  });
});

describe('attribute edits', () => {
  const screenOf = (doc: ReturnType<typeof base>) =>
    readFlow(doc).nodes.find((n) => n.id === 's1') as Extract<DslNode, { type: 'screen' }>;

  test('setNodeName / setNodeKind write through', () => {
    const doc = base();
    setNodeName(doc, 's1', 'Email');
    setNodeKind(doc, 's1', 'password');
    const s = screenOf(doc);
    expect(s.name).toBe('Email');
    expect(s.kind).toBe('password');
  });

  test('setNodeErrorMessage writes through on action/external and clears when empty', () => {
    const doc = hydrate({
      id: 'f',
      name: 'F',
      branding: { theme: 'light' },
      context: {},
      nodes: [
        { type: 'entry', id: 'entry' },
        { type: 'action', id: 'a1', name: 'Validate', kind: 'validate-credentials' },
        { type: 'external', id: 'x1', name: 'Google', kind: 'google' },
      ],
      edges: [],
      annotations: [],
      scenarios: [],
    });
    expect(setNodeErrorMessage(doc, 'a1', 'Bad password.').ok).toBe(true);
    let a = readFlow(doc).nodes.find((n) => n.id === 'a1');
    expect(a?.type === 'action' && a.errorMessage).toBe('Bad password.');

    expect(setNodeErrorMessage(doc, 'x1', '  Provider unavailable  ').ok).toBe(true);
    const x = readFlow(doc).nodes.find((n) => n.id === 'x1');
    expect(x?.type === 'external' && x.errorMessage).toBe('Provider unavailable');

    expect(setNodeErrorMessage(doc, 'a1', '   ').ok).toBe(true);
    a = readFlow(doc).nodes.find((n) => n.id === 'a1');
    expect(a?.type === 'action' && 'errorMessage' in a).toBe(false);
    expect(setNodeErrorMessage(doc, 's1', 'nope').ok).toBe(false);
  });

  test('setScreenFidelity, traits, fields replace cleanly and round-trip', () => {
    const doc = base();
    setScreenFidelity(doc, 's1', 'wireframe');
    setScreenTraits(doc, 's1', ['captcha', 'remember-me']);
    setScreenFields(doc, 's1', [
      { name: 'email', type: 'identifier', required: true },
      { name: 'pw', type: 'password', required: false },
    ]);
    const s = screenOf(doc);
    expect(s.fidelity).toBe('wireframe');
    expect(s.traits).toEqual(['captcha', 'remember-me']);
    expect(s.fields).toEqual([
      { name: 'email', type: 'identifier', required: true },
      { name: 'pw', type: 'password', required: false },
    ]);
    // Replacing again overwrites, not appends.
    setScreenTraits(doc, 's1', []);
    expect(screenOf(doc).traits).toEqual([]);
  });

  test('rejects an unknown node', () => {
    expect(setNodeName(base(), 'ghost', 'x').ok).toBe(false);
  });

  test('setDecisionPredicate writes through and round-trips', () => {
    const doc = base();
    setDecisionPredicate(doc, 'd1', { slot: 'risk.level', op: 'greater-than', value: 50 });
    const d = readFlow(doc).nodes.find((n) => n.id === 'd1') as Extract<
      DslNode,
      { type: 'decision' }
    >;
    expect(d.predicate).toEqual({ slot: 'risk.level', op: 'greater-than', value: 50 });
  });

  test('declareContextSlot adds a slot; rejects an empty name', () => {
    const doc = base();
    expect(declareContextSlot(doc, 'risk.level', { type: 'number' })).toEqual({ ok: true });
    expect(readFlow(doc).context['risk.level']).toEqual({ type: 'number' });
    expect(declareContextSlot(doc, '', { type: 'boolean' }).ok).toBe(false);
  });
});

describe('flow meta edits', () => {
  test('setFlowName / setFlowTheme write through metaMap and round-trip', () => {
    const doc = base();
    setFlowName(doc, 'Renamed flow');
    setFlowTheme(doc, 'dark');
    expect(metaMap(doc).get('name')).toBe('Renamed flow');
    expect((metaMap(doc).get('branding') as { theme: string }).theme).toBe('dark');
    expect(readFlow(doc).name).toBe('Renamed flow');
    expect(readFlow(doc).branding.theme).toBe('dark');
  });

  test('setCompanyName / setPrimaryColor merge into the branding blob without clobbering theme or each other', () => {
    const doc = base();
    setCompanyName(doc, 'Acme');
    expect(readFlow(doc).branding).toEqual({ theme: 'light', companyName: 'Acme' });
    setPrimaryColor(doc, '#4f46e5');
    expect(readFlow(doc).branding).toEqual({
      theme: 'light',
      companyName: 'Acme',
      primaryColor: '#4f46e5',
    });
    setCompanyName(doc, 'Acme Corp');
    expect(readFlow(doc).branding).toEqual({
      theme: 'light',
      companyName: 'Acme Corp',
      primaryColor: '#4f46e5',
    });
  });
});

describe('compound consistency', () => {
  test('add node + connecting edge leaves the doc consistent', () => {
    const doc = base();
    addNode(doc, newOutcome);
    addEdge(doc, {
      id: 'e5',
      source: 'd1',
      target: 'o3',
      trigger: { type: 'branch', value: false },
    });
    expect(nodesMap(doc).has('o3')).toBe(true);
    expect(edgesMap(doc).get('e5')?.get('target')).toBe('o3');
  });
});

describe('setEdgeTrigger', () => {
  test('updates interaction action on a screen edge', () => {
    const doc = base();
    expect(setEdgeTrigger(doc, 'e2', { type: 'interaction', action: 'back' }).ok).toBe(true);
    const edge = readFlow(doc).edges.find((e) => e.id === 'e2');
    expect(edge?.trigger).toEqual({ type: 'interaction', action: 'back' });
  });

  test('snaps primary/retreat screen interactions to their canonical side', () => {
    const doc = base();
    setEdgeSideOverrides(doc, 'e2', { sourceSide: 'bottom' });
    expect(setEdgeTrigger(doc, 'e2', { type: 'interaction', action: 'submit' }).ok).toBe(true);
    expect(edgeLayoutMap(doc).has('e2')).toBe(false);

    setEdgeSideOverrides(doc, 'e2', { sourceSide: 'bottom' });
    expect(setEdgeTrigger(doc, 'e2', { type: 'interaction', action: 'back' }).ok).toBe(true);
    expect(edgeLayoutMap(doc).has('e2')).toBe(false);
  });

  test('preserves a flexible interaction bottom override when the label changes', () => {
    const doc = base();
    setEdgeSideOverrides(doc, 'e2', { sourceSide: 'bottom' });
    expect(setEdgeTrigger(doc, 'e2', { type: 'interaction', action: 'resend-code' }).ok).toBe(true);
    expect(edgeLayoutMap(doc).get('e2')?.sourceSide).toBe('bottom');
  });

  test('preserves bottom when changing a retreat action to a flexible one', () => {
    const doc = base();
    expect(setEdgeTrigger(doc, 'e2', { type: 'interaction', action: 'back' }).ok).toBe(true);
    expect(edgeLayoutMap(doc).has('e2')).toBe(false);

    expect(setEdgeTrigger(doc, 'e2', { type: 'interaction', action: 'forgot-password' }).ok).toBe(
      true,
    );
    expect(edgeLayoutMap(doc).get('e2')?.sourceSide).toBe('bottom');
  });
});

describe('swapEdgeTriggers', () => {
  test('exchanges decision branch values atomically', () => {
    const doc = base();
    expect(swapEdgeTriggers(doc, 'e3', 'e4').ok).toBe(true);
    const flow = readFlow(doc);
    expect(flow.edges.find((e) => e.id === 'e3')?.trigger).toEqual({
      type: 'branch',
      value: false,
    });
    expect(flow.edges.find((e) => e.id === 'e4')?.trigger).toEqual({
      type: 'branch',
      value: true,
    });
  });

  test('preserves each edge source side when swapping decision branches', () => {
    const doc = base();
    expect(swapEdgeTriggers(doc, 'e3', 'e4').ok).toBe(true);

    const layout3 = edgeLayoutMap(doc).get('e3');
    const layout4 = edgeLayoutMap(doc).get('e4');
    expect(layout3?.sourceSide).toBe('right');
    expect(layout4?.sourceSide).toBe('bottom');

    const flow = readFlow(doc);
    const e3 = flow.edges.find((e) => e.id === 'e3');
    const e4 = flow.edges.find((e) => e.id === 'e4');
    if (!e3 || !e4) throw new Error('edges missing');
    expect(effectiveSourceHandle('decision', e3.trigger, layout3)).toBe('true');
    expect(effectiveSourceHandle('decision', e4.trigger, layout4)).toBe('false');

    const edgeLayout = Object.fromEntries(edgeLayoutMap(doc));
    const { nodes, edges } = flowToReactFlow(flow, {}, edgeLayout);
    const connected = nodes.find((n) => n.id === 'd1')?.data.connectedHandles;
    expect(connected?.has('true')).toBe(true);
    expect(connected?.has('false')).toBe(true);
    expect(edges.find((e) => e.id === 'e3')?.sourceHandle).toBe('true');
    expect(edges.find((e) => e.id === 'e4')?.sourceHandle).toBe('false');
  });

  test('preserves custom side overrides when swapping decision branches', () => {
    const doc = base();
    expect(setEdgeSideOverrides(doc, 'e3', { sourceSide: 'top' }).ok).toBe(true);
    expect(swapEdgeTriggers(doc, 'e3', 'e4').ok).toBe(true);

    const layout3 = edgeLayoutMap(doc).get('e3');
    const layout4 = edgeLayoutMap(doc).get('e4');
    expect(layout3?.sourceSide).toBe('top');
    expect(layout4?.sourceSide).toBe('bottom');

    const flow = readFlow(doc);
    const e3 = flow.edges.find((e) => e.id === 'e3');
    if (!e3) throw new Error('e3 missing');
    expect(e3.trigger).toEqual({ type: 'branch', value: false });
    expect(effectiveSourceHandle('decision', e3.trigger, layout3)).toBe('top-out');

    const edgeLayout = Object.fromEntries(edgeLayoutMap(doc));
    const { nodes, edges } = flowToReactFlow(flow, {}, edgeLayout);
    expect(nodes.find((n) => n.id === 'd1')?.data.connectedHandles?.has('top-out')).toBe(true);
    expect(edges.find((e) => e.id === 'e3')?.sourceHandle).toBe('top-out');
    expect(edges.find((e) => e.id === 'e4')?.sourceHandle).toBe('false');
  });
});

describe('scenario ops', () => {
  const scenarioA = {
    id: 'sc-a',
    name: 'A',
    initialContext: { 'user.exists': false },
    inputScript: [],
  };
  const scenarioB = {
    id: 'sc-b',
    name: 'B',
    initialContext: {},
    inputScript: [{ type: 'screen' as const, nodeId: 's1', action: 'submit' }],
  };

  test('putScenario creates and replaces whole records', () => {
    const doc = hydrate({
      id: 'f',
      name: 'F',
      branding: { theme: 'light' },
      context: {},
      nodes: [{ type: 'entry', id: 'entry' }],
      edges: [],
      annotations: [],
      scenarios: [scenarioA],
    });

    expect(putScenario(doc, { ...scenarioA, name: 'A renamed' }).ok).toBe(true);
    expect(readFlow(doc).scenarios[0]?.name).toBe('A renamed');

    expect(putScenario(doc, scenarioB).ok).toBe(true);
    expect(readFlow(doc).scenarios.map((s) => s.id)).toEqual(['sc-a', 'sc-b']);
    expect(readScenarioOrder(doc)).toEqual(['sc-a', 'sc-b']);
  });

  test('removeScenario drops record and order entry', () => {
    const doc = hydrate({
      id: 'f',
      name: 'F',
      branding: { theme: 'light' },
      context: {},
      nodes: [{ type: 'entry', id: 'entry' }],
      edges: [],
      annotations: [],
      scenarios: [scenarioA, scenarioB],
    });

    expect(removeScenario(doc, 'sc-a').ok).toBe(true);
    expect(scenariosMap(doc).has('sc-a')).toBe(false);
    expect(readFlow(doc).scenarios.map((s) => s.id)).toEqual(['sc-b']);
    expect(readScenarioOrder(doc)).toEqual(['sc-b']);
  });
});
