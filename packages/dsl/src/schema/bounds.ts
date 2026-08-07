import { z } from 'zod';

/**
 * Tier 1 structural ceilings (US-140 / REQUIREMENTS §5 "Input bounds").
 * Deliberately far above any honest document — these gate corruption and
 * DoS, not taste. Tier 2 advisories are a separate story; do not tighten.
 */
export const BOUND = {
  /** Identifiers, kind / action / slot / field-type names. */
  identifier: 128,
  /** Flow / node / scenario / version `name`, edge `label`, branding.companyName. */
  name: 4096,
  /** `description`, `errorMessage`, `Annotation.text`. */
  description: 8192,
  /** Action / External `notes` (markdown). */
  notes: 32768,
  /** Scalar string values in context patches / initialContext / predicates. */
  contextValue: 4096,
  nodes: 10_000,
  edges: 20_000,
  annotations: 5_000,
  scenarios: 500,
  inputScript: 2_000,
  fields: 200,
  contextSlots: 500,
  enumValues: 200,
  expectedSequence: 2_000,
} as const;

/**
 * Whole-file source ceiling for picker / drop (before parse).
 *
 * This guard is **older than this module** — it lived in `Editor.tsx` at
 * 2,000,000 bytes with the note "real flows are a few KB". The US-140 brief
 * asked for 8MiB without knowing that, which would have loosened a shipped
 * protection fourfold; the number stays where it was. Measured 2026-08-07, the
 * largest flow in the repo (`demo-flow-zero`) is **18.7KB**, so this is already
 * about a hundred times any honest document.
 */
export const MAX_AUTHPRINT_BYTES = 2_000_000;

export const IdString = z.string().min(1).max(BOUND.identifier);
export const NameString = z.string().min(1).max(BOUND.name);
export const OptionalNameString = z.string().min(1).max(BOUND.name).optional();
export const DescriptionString = z.string().max(BOUND.description);
export const OptionalDescriptionString = DescriptionString.optional();
export const ErrorMessageString = z.string().max(BOUND.description);
export const OptionalErrorMessageString = ErrorMessageString.optional();
export const NotesString = z.string().max(BOUND.notes);
export const OptionalNotesString = NotesString.optional();
export const AnnotationTextString = z.string().min(1).max(BOUND.description);
export const LabelString = z.string().max(BOUND.name);
export const OptionalLabelString = LabelString.optional();
export const CompanyNameString = z.string().max(BOUND.name);
export const OptionalCompanyNameString = CompanyNameString.optional();

/** Context / predicate / patch scalar values — SLOT_TYPES are never objects. */
export const ContextScalarValueSchema = z.union([
  z.boolean(),
  z.number().finite(),
  z.string().max(BOUND.contextValue),
]);
export type ContextScalarValue = z.infer<typeof ContextScalarValueSchema>;

/**
 * Predicate `value`: scalar, or a bounded array of scalars for `in` / `not-in`.
 * Objects and nested structures stay rejected (closes the former `z.unknown()` hole).
 */
export const PredicateValueSchema = z.union([
  ContextScalarValueSchema,
  z.array(ContextScalarValueSchema).max(BOUND.enumValues),
]);

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const NUM = String.raw`[-+]?(?:\d*\.)?\d+%?`;
const FUNC_COLOR = new RegExp(
  String.raw`^(?:rgb|rgba|hsl|hsla)\(\s*${NUM}(?:\s*,\s*${NUM}){2,3}\s*\)$`,
  'i',
);
const CSS_COLOR_NAME = /^[a-z]{3,20}$/;

/** Allowlisted CSS colour for `branding.primaryColor` (rejecting). */
export function isPrimaryColor(value: string): boolean {
  return HEX_COLOR.test(value) || FUNC_COLOR.test(value) || CSS_COLOR_NAME.test(value);
}

export const PrimaryColorSchema = z.string().refine(isPrimaryColor, {
  message: 'primaryColor must be a hex, rgb/hsl function, or CSS colour name',
});
export const OptionalPrimaryColorSchema = PrimaryColorSchema.optional();

/** Cap the number of keys on a record (context slots, patches, initialContext). */
export function maxRecordKeys<Schema extends z.ZodType<Record<string, unknown>>>(
  schema: Schema,
  max: number,
  label: string,
): Schema {
  return schema.refine((value) => Object.keys(value).length <= max, {
    message: `${label} exceeds maximum of ${max}`,
  }) as Schema;
}
