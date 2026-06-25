import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { type Flow, parse, serialize } from '@authprint/dsl';
import { parse as yamlParse } from 'yaml';
import { hydrate } from './hydrate.ts';
import { moveNode } from './ops.ts';
import {
  docToArtifact,
  extractLayout,
  findMatchingSidecar,
  isAuthprintFile,
  isLayoutSidecarFile,
  parseLayout,
  resolveLayoutForImport,
  serializeBundle,
  serializeLayout,
  serializeSemantic,
  serializeSidecar,
} from './persist.ts';
import { type LayoutPositions, layoutMap } from './schema.ts';

const DEMO_PATH = join(
  import.meta.dir,
  '../../../../../../packages/dsl-spec/examples/demo-flow-zero.authprint',
);
async function loadDemoFlowZero(): Promise<Flow> {
  const { flow } = parse(await Bun.file(DEMO_PATH).text());
  if (!flow) throw new Error('Demo Flow Zero failed to parse');
  return flow;
}

const flow: Flow = {
  id: 'f',
  name: 'F',
  theme: 'light',
  context: {},
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
    { type: 'outcome', id: 'o1', name: 'Done', kind: 'authenticated' },
  ],
  edges: [
    { id: 'e1', source: 'entry', target: 's1', trigger: { type: 'unconditional' } },
    { id: 'e2', source: 's1', target: 'o1', trigger: { type: 'interaction', action: 'submit' } },
  ],
  annotations: [],
  scenarios: [],
};

describe('docToArtifact', () => {
  test('empty layout when nothing has been positioned', () => {
    expect(docToArtifact(hydrate(flow)).layout).toEqual({});
  });

  test('returns flow + only the positioned nodes', () => {
    const layout: LayoutPositions = { s1: { x: 100, y: 200 } };
    const artifact = docToArtifact(hydrate(flow, layout));
    expect(artifact.flow.id).toBe('f');
    expect(artifact.flow.nodes).toHaveLength(3);
    expect(artifact.layout).toEqual(layout);
  });
});

describe('hydrate with layout', () => {
  test('seeds the layout map from the provided positions', () => {
    const layout: LayoutPositions = { entry: { x: 0, y: 0 }, s1: { x: 10, y: 20 } };
    expect(layoutMap(hydrate(flow, layout)).get('s1')).toEqual({ x: 10, y: 20 });
  });

  test('drops positions for nodes not in the flow (stale layout block)', () => {
    const layout: LayoutPositions = { s1: { x: 1, y: 2 }, ghost: { x: 9, y: 9 } };
    const map = layoutMap(hydrate(flow, layout));
    expect(map.has('s1')).toBe(true);
    expect(map.has('ghost')).toBe(false);
    expect(map.size).toBe(1);
  });

  test('no layout arg leaves the map empty (unchanged E24 behavior)', () => {
    expect(layoutMap(hydrate(flow)).size).toBe(0);
  });
});

describe('round-trip', () => {
  test('docToArtifact(hydrate(flow, layout)) preserves both halves', () => {
    const layout: LayoutPositions = { entry: { x: 5, y: 6 }, o1: { x: 300, y: 40 } };
    const artifact = docToArtifact(hydrate(flow, layout));
    expect(new Set(artifact.flow.nodes.map((n) => n.id))).toEqual(
      new Set(flow.nodes.map((n) => n.id)),
    );
    expect(artifact.layout).toEqual(layout);
  });
});

describe('serializeLayout / parseLayout', () => {
  test('round-trips a positions map through YAML', () => {
    const layout: LayoutPositions = { entry: { x: 5, y: 6 }, s1: { x: 100, y: 200 } };
    expect(parseLayout(yamlParse(serializeLayout(layout)))).toEqual(layout);
  });

  test('rounds to integer pixels', () => {
    const out = parseLayout(yamlParse(serializeLayout({ s1: { x: 12.7, y: -3.2 } })));
    expect(out).toEqual({ s1: { x: 13, y: -3 } });
  });

  test('empty map round-trips to empty', () => {
    expect(parseLayout(yamlParse(serializeLayout({})))).toEqual({});
  });

  test('deterministic + sorted: same map → same string regardless of insertion order', () => {
    const a = serializeLayout({ b: { x: 1, y: 1 }, a: { x: 2, y: 2 } });
    const b = serializeLayout({ a: { x: 2, y: 2 }, b: { x: 1, y: 1 } });
    expect(a).toBe(b);
    expect(a.indexOf('a:')).toBeLessThan(a.indexOf('b:'));
  });

  test('drops malformed entries, never throws', () => {
    const value = {
      good: { x: 1, y: 2 },
      missingY: { x: 5 },
      nonNumeric: { x: 'nope', y: 3 },
      notAnObject: 42,
      nullish: null,
    };
    expect(parseLayout(value)).toEqual({ good: { x: 1, y: 2 } });
  });

  test('non-object input → empty map', () => {
    expect(parseLayout(null)).toEqual({});
    expect(parseLayout('garbage')).toEqual({});
    expect(parseLayout(undefined)).toEqual({});
  });
});

// US-047 — the "edit → save → reload → identical" guarantee, in memory.
// reload(bundle) mirrors the loader: parse the flow (layout key ignored) +
// extract the layout, then hydrate both.
function reload(bundle: string): ReturnType<typeof docToArtifact> {
  const { flow: parsed } = parse(bundle);
  if (!parsed) throw new Error('bundle did not parse');
  return docToArtifact(hydrate(parsed, extractLayout(bundle)));
}

describe('bundle round-trip', () => {
  test('flow + manual positions survive save → reload', () => {
    const layout: LayoutPositions = { entry: { x: 5, y: 6 }, o1: { x: 300, y: 40 } };
    const out = reload(serializeBundle({ flow, layout }));
    expect(new Set(out.flow.nodes.map((n) => n.id))).toEqual(new Set(flow.nodes.map((n) => n.id)));
    expect(new Set(out.flow.edges.map((e) => e.id))).toEqual(new Set(flow.edges.map((e) => e.id)));
    expect(out.layout).toEqual(layout);
  });

  test('no manual positions → bundle is the plain semantic file (no layout: key)', () => {
    const bundle = serializeBundle({ flow, layout: {} });
    expect(bundle).toBe(serialize(flow));
    expect(bundle.includes('layout:')).toBe(false);
    expect(reload(bundle).layout).toEqual({});
  });

  test('deterministic: same artifact → byte-identical bundle', () => {
    const layout: LayoutPositions = { o1: { x: 1, y: 2 }, entry: { x: 3, y: 4 } };
    expect(serializeBundle({ flow, layout })).toBe(serializeBundle({ flow, layout }));
  });

  test('Demo Flow Zero: move some nodes → save → reload keeps moves, rest auto-layout', async () => {
    const demo = await loadDemoFlowZero();
    const doc = hydrate(demo);
    const movedA = demo.nodes[0]?.id ?? '';
    const movedB = demo.nodes[5]?.id ?? '';
    moveNode(doc, movedA, { x: 1234, y: 567 });
    moveNode(doc, movedB, { x: 88, y: 99 });

    const out = reload(serializeBundle(docToArtifact(doc)));

    // Only the moved nodes carry positions; everything else falls to elkjs.
    expect(out.layout).toEqual({ [movedA]: { x: 1234, y: 567 }, [movedB]: { x: 88, y: 99 } });
    // Flow intact across the round-trip.
    expect(out.flow.nodes).toHaveLength(demo.nodes.length);
    expect(out.flow.edges).toHaveLength(demo.edges.length);
    expect(out.flow.annotations).toHaveLength(demo.annotations.length);
    expect(out.flow.scenarios).toHaveLength(demo.scenarios.length);
  });
});

describe('export packagings (US-065)', () => {
  const layout: LayoutPositions = { entry: { x: 5, y: 6 }, s1: { x: 100, y: 200 } };
  const artifact = { flow, layout };

  test('serializeSemantic omits layout even when positions exist', () => {
    const semantic = serializeSemantic(artifact);
    expect(semantic).toBe(serialize(flow));
    expect(semantic.includes('layout:')).toBe(false);
  });

  test('serializeSemantic matches bundled when there are no manual positions', () => {
    expect(serializeSemantic({ flow, layout: {} })).toBe(serializeBundle({ flow, layout: {} }));
  });

  test('serializeSidecar emits semantic + layout files', () => {
    const { semantic, layout: layoutYaml } = serializeSidecar(artifact);
    expect(semantic).toBe(serialize(flow));
    expect(semantic.includes('layout:')).toBe(false);
    expect(parseLayout(yamlParse(layoutYaml))).toEqual(layout);
  });

  test('serializeSidecar with empty layout still emits an empty sidecar', () => {
    const { layout: layoutYaml } = serializeSidecar({ flow, layout: {} });
    expect(parseLayout(yamlParse(layoutYaml))).toEqual({});
  });

  test('bundled unchanged: still inline layout when positions exist', () => {
    const bundled = serializeBundle(artifact);
    expect(bundled.includes('layout:')).toBe(true);
    expect(extractLayout(bundled)).toEqual(layout);
    expect(serializeSemantic(artifact)).not.toBe(bundled);
  });
});

describe('import packaging detection (US-066)', () => {
  const layout: LayoutPositions = { entry: { x: 5, y: 6 }, s1: { x: 100, y: 200 } };
  const artifact = { flow, layout };

  function reloadImport(authprintSource: string, sidecarSource?: string) {
    const { flow: parsed } = parse(authprintSource);
    if (!parsed) throw new Error('authprint did not parse');
    return docToArtifact(hydrate(parsed, resolveLayoutForImport(authprintSource, sidecarSource)));
  }

  test('bundled import restores inline positions', () => {
    expect(reloadImport(serializeBundle(artifact)).layout).toEqual(layout);
  });

  test('semantic-only import yields empty layout (auto-layout)', () => {
    expect(reloadImport(serializeSemantic(artifact)).layout).toEqual({});
  });

  test('sidecar import restores positions from the layout file', () => {
    const { semantic, layout: layoutYaml } = serializeSidecar(artifact);
    expect(reloadImport(semantic, layoutYaml).layout).toEqual(layout);
  });

  test('bundled inline layout wins over a dropped sidecar', () => {
    const bundled = serializeBundle(artifact);
    const { layout: sidecarOnly } = serializeSidecar({
      flow,
      layout: { entry: { x: 1, y: 1 } },
    });
    expect(resolveLayoutForImport(bundled, sidecarOnly)).toEqual(layout);
  });

  test('authprintBasename pairs semantic and sidecar filenames', () => {
    expect(
      findMatchingSidecar('my-flow.authprint', [
        'other.authprint.layout',
        'my-flow.authprint.layout',
      ]),
    ).toBe('my-flow.authprint.layout');
  });

  test('isAuthprintFile rejects layout sidecars', () => {
    expect(isAuthprintFile('flow.authprint')).toBe(true);
    expect(isAuthprintFile('flow.authprint.layout')).toBe(false);
    expect(isLayoutSidecarFile('flow.authprint.layout')).toBe(true);
  });
});
