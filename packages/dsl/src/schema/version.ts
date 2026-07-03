import { z } from 'zod';

// Version metadata (see @authprint/dsl-spec semantics.md — Versions).
//
// Versions are stored separately from flow content (eventually a Firestore
// subcollection). This schema represents the metadata; the actual
// dsl+layout snapshot lives alongside as separate fields/documents.

export const VersionTypeSchema = z.enum(['auto', 'named']);

export const VersionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: VersionTypeSchema,
  createdAt: z.iso.datetime(),
  createdBy: z.string().min(1),
});

export type Version = z.infer<typeof VersionSchema>;
