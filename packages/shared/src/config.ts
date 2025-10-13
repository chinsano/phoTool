import { z } from 'zod';

export const exiftoolConfigSchema = z.object({
  taskTimeoutMs: z.number().int().positive().default(20000),
  maxConcurrent: z.number().int().positive().default(2),
});

export const appConfigSchema = z.object({
  defaultSourceDir: z.string().min(0).default(''),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  exiftool: exiftoolConfigSchema.default({}),
  exif: z.object({
    writeMode: z.enum(['sidecar-only', 'embedded-only', 'both']).default('sidecar-only'),
    readPreference: z.enum(['sidecar-first', 'embedded-first']).default('sidecar-first'),
  }).default({}),
  sync: z.object({
    autoImportOnSourceChange: z.boolean().default(false),
    autoWriteOnTagChange: z.boolean().default(false),
    allowManualImport: z.boolean().default(true),
    allowManualWrite: z.boolean().default(true)
  }).default({}),
  scanner: z.object({
    followSymlinks: z.boolean().default(false),
    ignoreGlobs: z.array(z.string()).default([]),
    extensions: z.array(z.string()).default(['.jpg', '.jpeg', '.png', '.heic', '.mp4', '.mov']),
    concurrency: z.number().int().positive().default(1),
    statusRetentionMs: z.number().int().positive().default(5 * 60 * 1000)
  }).default({})
});

export type AppConfig = z.infer<typeof appConfigSchema>;

export const defaultConfig: AppConfig = appConfigSchema.parse({});


