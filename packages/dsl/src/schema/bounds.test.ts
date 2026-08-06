import { describe, expect, test } from 'bun:test';
import { AnnotationSchema } from './annotation.ts';
import {
  BOUND,
  ContextScalarValueSchema,
  PredicateValueSchema,
  PrimaryColorSchema,
} from './bounds.ts';
import { FlowSchema } from './flow.ts';
import { ActionNodeSchema, ScreenNodeSchema } from './node.ts';
import { ContextSchema, ContextSlotSchema, PredicateSchema } from './predicate.ts';
import { ScenarioSchema } from './scenario.ts';

function entryOnlyFlow(over: Record<string, unknown> = {}) {
  return {
    id: 'f',
    name: 'F',
    nodes: [{ type: 'entry', id: 'e' }],
    ...over,
  };
}

type Case = {
  name: string;
  atCeiling: () => unknown;
  pastCeiling: () => unknown;
  parse: (value: unknown) => { success: boolean };
};

const stringCeiling = (n: number) => 'x'.repeat(n);

const cases: Case[] = [
  {
    name: 'flow id (identifier)',
    atCeiling: () => entryOnlyFlow({ id: stringCeiling(BOUND.identifier) }),
    pastCeiling: () => entryOnlyFlow({ id: stringCeiling(BOUND.identifier + 1) }),
    parse: (v) => FlowSchema.safeParse(v),
  },
  {
    name: 'flow name',
    atCeiling: () => entryOnlyFlow({ name: stringCeiling(BOUND.name) }),
    pastCeiling: () => entryOnlyFlow({ name: stringCeiling(BOUND.name + 1) }),
    parse: (v) => FlowSchema.safeParse(v),
  },
  {
    name: 'flow description',
    atCeiling: () => entryOnlyFlow({ description: stringCeiling(BOUND.description) }),
    pastCeiling: () => entryOnlyFlow({ description: stringCeiling(BOUND.description + 1) }),
    parse: (v) => FlowSchema.safeParse(v),
  },
  {
    name: 'nodes array',
    atCeiling: () =>
      entryOnlyFlow({
        nodes: Array.from({ length: BOUND.nodes }, (_, i) => ({
          type: 'entry',
          id: `e${i}`,
        })),
      }),
    pastCeiling: () =>
      entryOnlyFlow({
        nodes: Array.from({ length: BOUND.nodes + 1 }, (_, i) => ({
          type: 'entry',
          id: `e${i}`,
        })),
      }),
    parse: (v) => FlowSchema.safeParse(v),
  },
  {
    name: 'edges array',
    atCeiling: () =>
      entryOnlyFlow({
        nodes: [
          { type: 'entry', id: 'e' },
          { type: 'outcome', id: 'o', name: 'O', kind: 'authenticated' },
        ],
        edges: Array.from({ length: BOUND.edges }, (_, i) => ({
          id: `edge${i}`,
          source: 'e',
          target: 'o',
          trigger: { type: 'unconditional' },
        })),
      }),
    pastCeiling: () =>
      entryOnlyFlow({
        nodes: [
          { type: 'entry', id: 'e' },
          { type: 'outcome', id: 'o', name: 'O', kind: 'authenticated' },
        ],
        edges: Array.from({ length: BOUND.edges + 1 }, (_, i) => ({
          id: `edge${i}`,
          source: 'e',
          target: 'o',
          trigger: { type: 'unconditional' },
        })),
      }),
    parse: (v) => FlowSchema.safeParse(v),
  },
  {
    name: 'annotations array',
    atCeiling: () =>
      entryOnlyFlow({
        annotations: Array.from({ length: BOUND.annotations }, (_, i) => ({
          id: `a${i}`,
          kind: 'note',
          text: 'n',
          attachment: { type: 'floating', x: 0, y: 0 },
        })),
      }),
    pastCeiling: () =>
      entryOnlyFlow({
        annotations: Array.from({ length: BOUND.annotations + 1 }, (_, i) => ({
          id: `a${i}`,
          kind: 'note',
          text: 'n',
          attachment: { type: 'floating', x: 0, y: 0 },
        })),
      }),
    parse: (v) => FlowSchema.safeParse(v),
  },
  {
    name: 'scenarios array',
    atCeiling: () =>
      entryOnlyFlow({
        scenarios: Array.from({ length: BOUND.scenarios }, (_, i) => ({
          id: `s${i}`,
          name: `S${i}`,
          initialContext: {},
          inputScript: [],
        })),
      }),
    pastCeiling: () =>
      entryOnlyFlow({
        scenarios: Array.from({ length: BOUND.scenarios + 1 }, (_, i) => ({
          id: `s${i}`,
          name: `S${i}`,
          initialContext: {},
          inputScript: [],
        })),
      }),
    parse: (v) => FlowSchema.safeParse(v),
  },
  {
    name: 'screen fields',
    atCeiling: () => ({
      type: 'screen',
      id: 's',
      name: 'S',
      kind: 'password',
      fields: Array.from({ length: BOUND.fields }, (_, i) => ({
        name: `f${i}`,
        type: 'text',
        required: false,
      })),
    }),
    pastCeiling: () => ({
      type: 'screen',
      id: 's',
      name: 'S',
      kind: 'password',
      fields: Array.from({ length: BOUND.fields + 1 }, (_, i) => ({
        name: `f${i}`,
        type: 'text',
        required: false,
      })),
    }),
    parse: (v) => ScreenNodeSchema.safeParse(v),
  },
  {
    name: 'action notes',
    atCeiling: () => ({
      type: 'action',
      id: 'a',
      name: 'A',
      kind: 'send-otp',
      notes: stringCeiling(BOUND.notes),
    }),
    pastCeiling: () => ({
      type: 'action',
      id: 'a',
      name: 'A',
      kind: 'send-otp',
      notes: stringCeiling(BOUND.notes + 1),
    }),
    parse: (v) => ActionNodeSchema.safeParse(v),
  },
  {
    name: 'annotation text',
    atCeiling: () => ({
      id: 'a',
      kind: 'note',
      text: stringCeiling(BOUND.description),
      attachment: { type: 'floating', x: 0, y: 0 },
    }),
    pastCeiling: () => ({
      id: 'a',
      kind: 'note',
      text: stringCeiling(BOUND.description + 1),
      attachment: { type: 'floating', x: 0, y: 0 },
    }),
    parse: (v) => AnnotationSchema.safeParse(v),
  },
  {
    name: 'context slots',
    atCeiling: () =>
      Object.fromEntries(
        Array.from({ length: BOUND.contextSlots }, (_, i) => [`s${i}`, { type: 'boolean' }]),
      ),
    pastCeiling: () =>
      Object.fromEntries(
        Array.from({ length: BOUND.contextSlots + 1 }, (_, i) => [`s${i}`, { type: 'boolean' }]),
      ),
    parse: (v) => ContextSchema.safeParse(v),
  },
  {
    name: 'enum values',
    atCeiling: () => ({
      type: 'enum',
      values: Array.from({ length: BOUND.enumValues }, (_, i) => `v${i}`),
    }),
    pastCeiling: () => ({
      type: 'enum',
      values: Array.from({ length: BOUND.enumValues + 1 }, (_, i) => `v${i}`),
    }),
    parse: (v) => ContextSlotSchema.safeParse(v),
  },
  {
    name: 'inputScript steps',
    atCeiling: () => ({
      id: 's',
      name: 'S',
      initialContext: {},
      inputScript: Array.from({ length: BOUND.inputScript }, () => ({
        type: 'screen',
        nodeId: 'n',
        action: 'submit',
      })),
    }),
    pastCeiling: () => ({
      id: 's',
      name: 'S',
      initialContext: {},
      inputScript: Array.from({ length: BOUND.inputScript + 1 }, () => ({
        type: 'screen',
        nodeId: 'n',
        action: 'submit',
      })),
    }),
    parse: (v) => ScenarioSchema.safeParse(v),
  },
  {
    name: 'expectedOutcome.sequence',
    atCeiling: () => ({
      id: 's',
      name: 'S',
      initialContext: {},
      inputScript: [],
      expectedOutcome: {
        sequence: Array.from({ length: BOUND.expectedSequence }, (_, i) => `n${i}`),
      },
    }),
    pastCeiling: () => ({
      id: 's',
      name: 'S',
      initialContext: {},
      inputScript: [],
      expectedOutcome: {
        sequence: Array.from({ length: BOUND.expectedSequence + 1 }, (_, i) => `n${i}`),
      },
    }),
    parse: (v) => ScenarioSchema.safeParse(v),
  },
  {
    name: 'context scalar string',
    atCeiling: () => stringCeiling(BOUND.contextValue),
    pastCeiling: () => stringCeiling(BOUND.contextValue + 1),
    parse: (v) => ContextScalarValueSchema.safeParse(v),
  },
  {
    name: 'predicate in-array length',
    atCeiling: () => Array.from({ length: BOUND.enumValues }, (_, i) => `v${i}`),
    pastCeiling: () => Array.from({ length: BOUND.enumValues + 1 }, (_, i) => `v${i}`),
    parse: (v) => PredicateValueSchema.safeParse(v),
  },
];

describe('Tier 1 structural ceilings (US-140)', () => {
  for (const c of cases) {
    test(`${c.name}: at ceiling parses, one past rejects`, () => {
      expect(c.parse(c.atCeiling()).success).toBe(true);
      expect(c.parse(c.pastCeiling()).success).toBe(false);
    });
  }
});

describe('primaryColor allowlist (US-140)', () => {
  const ok = [
    '#f00',
    '#ff00',
    '#ff0000',
    '#ff000080',
    'rgb(1,2,3)',
    'rgba(1,2,3,0.5)',
    'hsl(120,100%,50%)',
    'hsla(120,50%,40%,0.2)',
    'rebeccapurple',
    'red',
  ];
  const bad = [
    'javascript:alert(1)',
    'url(https://x)',
    'var(--c)',
    'image-set(url(x))',
    '#gg',
    'RGB(a,b,c)',
    'too-long-colour-name-xx',
    'ab',
    '',
  ];

  test.each(ok)('accepts %s', (value) => {
    expect(PrimaryColorSchema.safeParse(value).success).toBe(true);
  });

  test.each(bad)('rejects %s', (value) => {
    expect(PrimaryColorSchema.safeParse(value).success).toBe(false);
  });
});

describe('z.unknown() holes closed (US-140)', () => {
  test('predicate rejects object values', () => {
    expect(
      PredicateSchema.safeParse({ slot: 's', op: 'eq', value: { nested: true } }).success,
    ).toBe(false);
  });

  test('predicate accepts in-array of scalars', () => {
    expect(
      PredicateSchema.safeParse({
        slot: 'device.type',
        op: 'in',
        value: ['mobile', 'tablet'],
      }).success,
    ).toBe(true);
  });

  test('initialContext rejects nested objects', () => {
    expect(
      ScenarioSchema.safeParse({
        id: 's',
        name: 'S',
        initialContext: { slot: { deep: 1 } },
        inputScript: [],
      }).success,
    ).toBe(false);
  });

  test('context patch rejects nested objects', () => {
    expect(
      ScenarioSchema.safeParse({
        id: 's',
        name: 'S',
        initialContext: {},
        inputScript: [
          {
            type: 'screen',
            nodeId: 'n',
            action: 'submit',
            set: { slot: { deep: 1 } },
          },
        ],
      }).success,
    ).toBe(false);
  });
});
