import { z } from 'zod';

// Minimal typed metadata surface we need now; can extend later
export const exifGpsSchema = z.object({
  lat: z.number().nullable(),
  lon: z.number().nullable(),
});

export const exifDimensionsSchema = z.object({
  width: z.number().int().nonnegative().nullable(),
  height: z.number().int().nonnegative().nullable(),
  durationSec: z.number().nonnegative().nullable(),
});

export const exifSubjectsSchema = z.object({
  subjects: z.array(z.string()).readonly(),
  hierarchicalSubjects: z.array(z.array(z.string())).readonly(),
});

export const exifCoreSchema = z.object({
  takenAt: z.string().datetime().nullable(),
  gps: exifGpsSchema,
  dimensions: exifDimensionsSchema,
});

export const readMetadataResultSchema = exifCoreSchema.and(exifSubjectsSchema);

export type ReadMetadataResult = z.infer<typeof readMetadataResultSchema>;

export const writeSubjectsInputSchema = z.object({
  filePath: z.string().min(1),
  subjects: z.array(z.string()),
});

export const writeHierarchicalSubjectsInputSchema = z.object({
  filePath: z.string().min(1),
  paths: z.array(z.array(z.string())),
});

export interface ExifToolPort {
  start(): Promise<void>;
  stop(): Promise<void>;
  readMetadata(filePath: string): Promise<ReadMetadataResult>;
  writeSubjects(filePath: string, subjects: string[]): Promise<void>;
  writeHierarchicalSubjects(filePath: string, paths: string[][]): Promise<void>;
  writeEmbeddedSubjects(filePath: string, subjects: string[]): Promise<void>;
  writeEmbeddedHierarchicalSubjects(filePath: string, paths: string[][]): Promise<void>;
}


