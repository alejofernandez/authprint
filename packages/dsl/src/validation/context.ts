// US-023 — Context + predicate + scenario-context integrity.

import type { Diagnostic } from '../diagnostic.ts';
import type { Flow } from '../schema/flow.ts';
import type { ContextSlot, Predicate } from '../schema/predicate.ts';
import type { PredicateOp, SlotType } from '../vocabulary.ts';

export function checkContextIntegrity(flow: Flow): Diagnostic[] {
  return [...checkDecisionPredicates(flow), ...checkScenarioInitialContext(flow)];
}

// ─── Decision predicates ────────────────────────────────────────────────────
// For each Decision:
//   1. predicate.slot references a declared Context slot.
//   2. predicate.op is compatible with slot.type.
//   3. predicate.value type matches slot.type (and is one of slot.values for enums).

function checkDecisionPredicates(flow: Flow): Diagnostic[] {
  const out: Diagnostic[] = [];
  const ctx = flow.context;

  for (const [idx, node] of flow.nodes.entries()) {
    if (node.type !== 'decision') continue;

    const { predicate } = node;
    const slot = ctx[predicate.slot] as ContextSlot | undefined;
    const path = `nodes[${idx}].predicate`;

    if (!slot) {
      out.push({
        severity: 'error',
        code: 'validation-predicate-slot-undeclared',
        message: `decision '${node.id}' references undeclared context slot '${predicate.slot}'`,
        path: `${path}.slot`,
        target: { kind: 'node', id: node.id },
      });
      continue; // can't check op/value without a slot type
    }

    if (!opCompatibleWithSlot(predicate.op, slot.type)) {
      out.push({
        severity: 'error',
        code: 'validation-predicate-op-incompatible',
        message: `decision '${node.id}' uses op '${predicate.op}' which is not valid for ${slot.type} slot '${predicate.slot}'`,
        path: `${path}.op`,
        target: { kind: 'node', id: node.id },
      });
    }

    const valueErr = checkPredicateValueAgainstSlot(predicate, slot);
    if (valueErr !== null) {
      out.push({
        severity: 'error',
        code: 'validation-predicate-value-type-mismatch',
        message: `decision '${node.id}' predicate value ${valueErr} (slot '${predicate.slot}' is ${slot.type})`,
        path: `${path}.value`,
        target: { kind: 'node', id: node.id },
      });
    }
  }

  return out;
}

// ─── Scenario initialContext ────────────────────────────────────────────────
// Every key in initialContext must be a declared slot, and the value must
// match the slot's declared type.

function checkScenarioInitialContext(flow: Flow): Diagnostic[] {
  const out: Diagnostic[] = [];
  const ctx = flow.context;

  for (const [sIdx, scenario] of flow.scenarios.entries()) {
    for (const [slotName, value] of Object.entries(scenario.initialContext)) {
      const slot = ctx[slotName] as ContextSlot | undefined;
      if (!slot) {
        out.push({
          severity: 'error',
          code: 'validation-scenario-context-slot-undeclared',
          message: `scenario '${scenario.id}' initialContext key '${slotName}' is not a declared context slot`,
          path: `scenarios[${sIdx}].initialContext.${slotName}`,
        });
        continue;
      }

      if (!valueMatchesSlotType(value, slot)) {
        out.push({
          severity: 'error',
          code: 'validation-scenario-context-value-type-mismatch',
          message: `scenario '${scenario.id}' initialContext['${slotName}'] does not match slot type '${slot.type}'`,
          path: `scenarios[${sIdx}].initialContext.${slotName}`,
        });
      }
    }
  }

  return out;
}

// ─── Compatibility tables ───────────────────────────────────────────────────

const OPS_FOR_TYPE: Record<SlotType, ReadonlyArray<PredicateOp>> = {
  boolean: ['equals', 'not-equals'],
  number: [
    'equals',
    'not-equals',
    'greater-than',
    'less-than',
    'greater-than-or-equal',
    'less-than-or-equal',
    'in',
    'not-in',
  ],
  string: ['equals', 'not-equals', 'in', 'not-in'],
  enum: ['equals', 'not-equals', 'in', 'not-in'],
};

function opCompatibleWithSlot(op: PredicateOp, slotType: SlotType): boolean {
  return OPS_FOR_TYPE[slotType].includes(op);
}

function checkPredicateValueAgainstSlot(p: Predicate, slot: ContextSlot): string | null {
  // For `in` / `not-in`, value should be an array.
  if (p.op === 'in' || p.op === 'not-in') {
    if (!Array.isArray(p.value)) {
      return `must be an array for op '${p.op}', got ${typeName(p.value)}`;
    }
    for (const item of p.value) {
      if (!valueMatchesSlotType(item, slot)) {
        return `contains a ${typeName(item)} but slot is ${slot.type}`;
      }
    }
    return null;
  }

  if (!valueMatchesSlotType(p.value, slot)) {
    return `is ${typeName(p.value)} but should be ${slot.type}`;
  }
  return null;
}

function valueMatchesSlotType(value: unknown, slot: ContextSlot): boolean {
  switch (slot.type) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'string':
      return typeof value === 'string';
    case 'enum':
      return typeof value === 'string' && (slot.values ?? []).includes(value);
  }
}

function typeName(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}
