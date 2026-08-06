import { z } from 'zod';
import { IdString, NameString } from './bounds.ts';

// Version metadata (see @authprint/dsl-spec semantics.md — Versions).
//
// Versions are stored separately from flow content (eventually a Firestore
// subcollection). This schema represents the metadata; the actual
// dsl+layout snapshot lives alongside as separate fields/documents.

export const VersionTypeSchema = z.enum(['auto', 'named']);

export const VersionSchema = z.object({
  id: IdString,
  name: NameString,
  type: VersionTypeSchema,
  createdAt: z.iso.datetime(),
  createdBy: IdString,
});

export type Version = z.infer<typeof VersionSchema>;
