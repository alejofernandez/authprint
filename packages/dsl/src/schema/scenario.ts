import { z } from 'zod';
import {
  BOUND,
  ContextScalarValueSchema,
  IdString,
  maxRecordKeys,
  NameString,
  OptionalDescriptionString,
} from './bounds.ts';

// Scenarios (see @authprint/dsl-spec semantics.md) — first-class entities that
// describe a trace through the flow under declared conditions. Authprint
// walks the model with these inputs (model checking, NOT execution).

// ─── Script steps ───────────────────────────────────────────────────────────
// Each step says: at this node, take this action / inject this result.

const ContextPatchSchema = maxRecordKeys(
  z.record(IdString, ContextScalarValueSchema),
  BOUND.contextSlots,
  'context patch',
);

export const ScreenStepSchema = z.object({
  type: z.literal('screen'),
  nodeId: IdString,
  action: IdString,
  set: ContextPatchSchema.optional(),
});

export const ActionStepSchema = z.object({
  type: z.literal('action'),
  nodeId: IdString,
  result: z.enum(['success', 'error']),
  // Scenario-authored copy for the error banner when this failure is walked;
  // overrides the node's own errorMessage for this scenario only.
  errorMessage: z.string().min(1).max(BOUND.description).optional(),
  set: ContextPatchSchema.optional(),
});

export const ExternalStepSchema = z.object({
  type: z.literal('external'),
  nodeId: IdString,
  result: z.enum(['success', 'error', 'denied', 'cancelled']),
  errorMessage: z.string().min(1).max(BOUND.description).optional(),
  set: ContextPatchSchema.optional(),
});

export const ScriptStepSchema = z.discriminatedUnion('type', [
  ScreenStepSchema,
  ActionStepSchema,
  ExternalStepSchema,
]);

export type ScriptStep = z.infer<typeof ScriptStepSchema>;

// ─── Expected outcome (optional assertion) ──────────────────────────────────

export const ExpectedOutcomeSchema = z.object({
  outcomeId: IdString.optional(),
  sequence: z.array(IdString).max(BOUND.expectedSequence).optional(),
});

export type ExpectedOutcome = z.infer<typeof ExpectedOutcomeSchema>;

// ─── Scenario ───────────────────────────────────────────────────────────────

export const ScenarioSchema = z.object({
  id: IdString,
  name: NameString,
  description: OptionalDescriptionString,
  // Initial Context slot values. Type-vs-value cross-check happens at the
  // model-checking layer (it needs access to the Flow's Context declaration).
  initialContext: maxRecordKeys(
    z.record(IdString, ContextScalarValueSchema),
    BOUND.contextSlots,
    'initialContext',
  ),
  inputScript: z.array(ScriptStepSchema).max(BOUND.inputScript),
  expectedOutcome: ExpectedOutcomeSchema.optional(),
});

export type Scenario = z.infer<typeof ScenarioSchema>;
