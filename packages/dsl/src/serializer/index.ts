// Serializer: Flow → YAML text.
//
// Pipeline: canonicalize key order per the spec (grammar.md §"Canonical emit
// order") → omit defaults for cleaner diffs → yaml.stringify with our chosen
// options.
//
// Output is byte-stable for a given Flow. Defaults are omitted (zod fills
// them back on parse) so the round-trip is AST-identical, not necessarily
// byte-identical to the original input.

import { stringify as yamlStringify } from 'yaml';
import type { Annotation, AnnotationAttachment } from '../schema/annotation.ts';
import type { Edge, Trigger } from '../schema/edge.ts';
import type { Field } from '../schema/field.ts';
import type { Flow } from '../schema/flow.ts';
import type {
  ActionNode,
  DecisionNode,
  EntryNode,
  ExternalNode,
  Node,
  OutcomeNode,
  ScreenNode,
} from '../schema/node.ts';
import type { Context, Predicate } from '../schema/predicate.ts';
import type { Scenario, ScriptStep } from '../schema/scenario.ts';

export type SerializeOptions = {
  // Reserved for future options (e.g., includeLayout when the layout layer
  // is integrated). Empty in v1.
};

export function serialize(flow: Flow, _options: SerializeOptions = {}): string {
  const canonical = canonicalizeFlow(flow);
  return yamlStringify(canonical, {
    indent: 2,
    lineWidth: 0, // disable line wrapping for predictable diffs
    defaultStringType: 'PLAIN',
    defaultKeyType: 'PLAIN',
    singleQuote: false,
    aliasDuplicateObjects: false, // defensive — we don't generate anchors
  });
}

// ─── Per-entity canonicalizers ──────────────────────────────────────────────
//
// Each function returns a plain object with keys in canonical order. Empty
// collections and default-value scalars are omitted for cleaner output;
// zod's defaults restore them on parse.

function canonicalizeFlow(flow: Flow): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: flow.id,
    name: flow.name,
  };
  if (flow.description !== undefined) out.description = flow.description;
  if (flow.theme !== 'light') out.theme = flow.theme;
  if (Object.keys(flow.context).length > 0) out.context = canonicalizeContext(flow.context);
  if (flow.nodes.length > 0) out.nodes = flow.nodes.map(canonicalizeNode);
  if (flow.edges.length > 0) out.edges = flow.edges.map(canonicalizeEdge);
  if (flow.annotations.length > 0) {
    out.annotations = flow.annotations.map(canonicalizeAnnotation);
  }
  if (flow.scenarios.length > 0) {
    out.scenarios = flow.scenarios.map(canonicalizeScenario);
  }
  return out;
}

function canonicalizeContext(context: Context): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [slotName, slot] of Object.entries(context)) {
    const slotOut: Record<string, unknown> = { type: slot.type };
    if (slot.values !== undefined) slotOut.values = slot.values;
    out[slotName] = slotOut;
  }
  return out;
}

function canonicalizeNode(node: Node): Record<string, unknown> {
  switch (node.type) {
    case 'entry':
      return canonicalizeEntry(node);
    case 'screen':
      return canonicalizeScreen(node);
    case 'decision':
      return canonicalizeDecision(node);
    case 'action':
      return canonicalizeAction(node);
    case 'external':
      return canonicalizeExternal(node);
    case 'outcome':
      return canonicalizeOutcome(node);
  }
}

function canonicalizeEntry(n: EntryNode): Record<string, unknown> {
  return { type: n.type, id: n.id };
}

function canonicalizeScreen(n: ScreenNode): Record<string, unknown> {
  const out: Record<string, unknown> = {
    type: n.type,
    id: n.id,
    name: n.name,
    kind: n.kind,
  };
  if (n.traits.length > 0) out.traits = n.traits;
  if (n.fields.length > 0) out.fields = n.fields.map(canonicalizeField);
  if (n.fidelity !== 'lo-fi') out.fidelity = n.fidelity;
  return out;
}

function canonicalizeDecision(n: DecisionNode): Record<string, unknown> {
  const out: Record<string, unknown> = {
    type: n.type,
    id: n.id,
  };
  if (n.name !== undefined) out.name = n.name;
  out.kind = n.kind;
  out.predicate = canonicalizePredicate(n.predicate);
  return out;
}

function canonicalizeAction(n: ActionNode): Record<string, unknown> {
  return { type: n.type, id: n.id, name: n.name, kind: n.kind };
}

function canonicalizeExternal(n: ExternalNode): Record<string, unknown> {
  return { type: n.type, id: n.id, name: n.name, kind: n.kind };
}

function canonicalizeOutcome(n: OutcomeNode): Record<string, unknown> {
  return { type: n.type, id: n.id, name: n.name, kind: n.kind };
}

function canonicalizeField(f: Field): Record<string, unknown> {
  return { name: f.name, type: f.type, required: f.required };
}

function canonicalizePredicate(p: Predicate): Record<string, unknown> {
  return { slot: p.slot, op: p.op, value: p.value };
}

function canonicalizeEdge(edge: Edge): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: edge.id,
    source: edge.source,
    target: edge.target,
  };
  if (edge.label !== undefined) out.label = edge.label;
  out.trigger = canonicalizeTrigger(edge.trigger);
  return out;
}

function canonicalizeTrigger(t: Trigger): Record<string, unknown> {
  switch (t.type) {
    case 'unconditional':
      return { type: t.type };
    case 'interaction':
      return { type: t.type, action: t.action };
    case 'branch':
      return { type: t.type, value: t.value };
    case 'on-success':
    case 'on-error':
    case 'on-denied':
    case 'on-cancelled':
      return { type: t.type };
  }
}

function canonicalizeAnnotation(a: Annotation): Record<string, unknown> {
  return {
    id: a.id,
    kind: a.kind,
    text: a.text,
    attachment: canonicalizeAttachment(a.attachment),
  };
}

function canonicalizeAttachment(a: AnnotationAttachment): Record<string, unknown> {
  switch (a.type) {
    case 'node':
      return { type: a.type, nodeId: a.nodeId };
    case 'edge':
      return { type: a.type, edgeId: a.edgeId };
    case 'floating':
      return { type: a.type, x: a.x, y: a.y };
  }
}

function canonicalizeScenario(s: Scenario): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: s.id,
    name: s.name,
  };
  if (s.description !== undefined) out.description = s.description;
  out.initialContext = s.initialContext;
  out.inputScript = s.inputScript.map(canonicalizeScriptStep);
  if (s.expectedOutcome !== undefined) {
    const eo: Record<string, unknown> = {};
    if (s.expectedOutcome.outcomeId !== undefined) eo.outcomeId = s.expectedOutcome.outcomeId;
    if (s.expectedOutcome.sequence !== undefined) eo.sequence = s.expectedOutcome.sequence;
    out.expectedOutcome = eo;
  }
  return out;
}

function canonicalizeScriptStep(step: ScriptStep): Record<string, unknown> {
  switch (step.type) {
    case 'screen':
      return { type: step.type, nodeId: step.nodeId, action: step.action };
    case 'action':
      return { type: step.type, nodeId: step.nodeId, result: step.result };
    case 'external':
      return { type: step.type, nodeId: step.nodeId, result: step.result };
  }
}
