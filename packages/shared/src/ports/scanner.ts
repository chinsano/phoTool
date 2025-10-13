import { z } from 'zod';

export const scanModeSchema = z.enum(['auto', 'full']);
export type ScanMode = z.infer<typeof scanModeSchema>;

export const scanRequestSchema = z.object({
  roots: z.array(z.string().min(1)).min(1),
  mode: scanModeSchema.default('auto').optional(),
});
export type ScanRequest = z.infer<typeof scanRequestSchema>;

export const scanIdSchema = z.string().min(1).brand<'ScanId'>();
export type ScanId = z.infer<typeof scanIdSchema>;

export const scanPhaseSchema = z.enum(['queued', 'running', 'completed', 'failed']);

export const scanStatusSchema = z.object({
  id: scanIdSchema,
  phase: scanPhaseSchema,
  total: z.number().int().nonnegative().default(0),
  scanned: z.number().int().nonnegative().default(0),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
  error: z.string().optional(),
});
export type ScanStatus = z.infer<typeof scanStatusSchema>;

export const scanResultSchema = z.object({
  added: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  deleted: z.number().int().nonnegative(),
});
export type ScanResult = z.infer<typeof scanResultSchema>;

export interface ScannerPort {
  runScan(request: ScanRequest): Promise<{ scanId: ScanId }>;
  getStatus(scanId: ScanId): Promise<ScanStatus>;
}


