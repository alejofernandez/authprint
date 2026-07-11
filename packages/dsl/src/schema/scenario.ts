import { z } from 'zod';

// Scenarios (see @authprint/dsl-spec semantics.md) — first-class entities that
// describe a trace through the flow under declared conditions. Authprint
// walks the model with these inputs (model checking, NOT execution).

// ─── Script steps ───────────────────────────────────────────────────────────
// Each step says: at this node, take this action / inject this result.

const ContextPatchSchema = z.record(z.string(), z.unknown());

export const ScreenStepSchema = z.object({
  type: z.literal('screen'),
  nodeId: z.string().min(1),
  action: z.string().min(1),
  set: ContextPatchSchema.optional(),
});

export const ActionStepSchema = z.object({
  type: z.literal('action'),
  nodeId: z.string().min(1),
  result: z.enum(['success', 'error']),
  set: ContextPatchSchema.optional(),
});

export const ExternalStepSchema = z.object({
  type: z.literal('external'),
  nodeId: z.string().min(1),
  result: z.enum(['success', 'error', 'denied', 'cancelled']),
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
  outcomeId: z.string().min(1).optional(),
  sequence: z.array(z.string().min(1)).optional(),
});

export type ExpectedOutcome = z.infer<typeof ExpectedOutcomeSchema>;

// ─── Scenario ───────────────────────────────────────────────────────────────

export const ScenarioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  // Initial Context slot values. Type-vs-value cross-check happens at the
  // model-checking layer (it needs access to the Flow's Context declaration).
  initialContext: z.record(z.string(), z.unknown()),
  inputScript: z.array(ScriptStepSchema),
  expectedOutcome: ExpectedOutcomeSchema.optional(),
});

export type Scenario = z.infer<typeof ScenarioSchema>;
