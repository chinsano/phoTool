import { scanRequestSchema, scanStatusSchema, type ScanId } from '@phoTool/shared';
import { Router } from 'express';

import { loadConfig } from '../config.js';
import { NotFoundError, ValidationError } from '../errors.js';
import { logger } from '../logger.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ScannerService } from '../services/scanner/index.js';
import { sanitizePaths } from '../utils/sanitization.js';

interface StatusEntry {
  id: string;
  phase: 'queued' | 'running' | 'completed' | 'failed';
  total: number;
  scanned: number;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

const statuses = new Map<string, StatusEntry>();

export function createScanRouter() {
  const router = Router();
  const cfg = loadConfig();
  const service = new ScannerService();

  router.post('/', asyncHandler(async (req, res) => {
    const parsedResult = scanRequestSchema.safeParse(req.body);
    if (!parsedResult.success) {
      throw new ValidationError('Invalid scan request', { details: parsedResult.error.flatten() });
    }
    const parsed = parsedResult.data;
    
    // Sanitize paths to prevent path traversal attacks
    const sanitizedRoots = sanitizePaths(parsed.roots);
    
    const id: ScanId = `${Date.now()}-${Math.random().toString(36).slice(2)}` as ScanId;
    const status: StatusEntry = { id, phase: 'queued', total: 0, scanned: 0 };
    statuses.set(id, status);

    // Start async job
    void (async () => {
      const s = statuses.get(id);
      if (!s) return;
      s.phase = 'running';
      s.startedAt = new Date().toISOString();
      try {
        // We cannot know total cheaply without pre-walk; approximate via listFiles length
        const exts = cfg.scanner.extensions;
        // Run scan with sanitized paths
        const result = await service.run(sanitizedRoots, parsed.mode ?? 'auto', exts);
        s.phase = 'completed';
        s.scanned = result.added + result.updated + result.deleted;
        s.total = s.scanned;
        s.finishedAt = new Date().toISOString();
      } catch (err) {
        logger.error({ err }, 'Scan failed');
        s.phase = 'failed';
        s.error = (err as Error)?.message ?? 'unknown error';
        s.finishedAt = new Date().toISOString();
      } finally {
        // Retention window cleanup
        setTimeout(() => statuses.delete(id), cfg.scanner.statusRetentionMs);
      }
    })();

    res.json({ scanId: id });
  }));

  router.get('/status', asyncHandler(async (req, res) => {
    const id = String(req.query.scanId || '');
    const s = statuses.get(id);
    if (!s) {
      throw new NotFoundError('Unknown scanId');
    }
    const payload = scanStatusSchema.parse({ ...s });
    res.json(payload);
  }));

  return router;
}

