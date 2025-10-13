import { scanRequestSchema, scanStatusSchema, type ScanId } from '@phoTool/shared';
import { Router } from 'express';

import { loadConfig } from '../config.js';
import { logger } from '../logger.js';
import { ScannerService } from '../services/scanner/index.js';

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

  router.post('/', async (req, res, next) => {
    try {
      const parsedResult = scanRequestSchema.safeParse(req.body);
      if (!parsedResult.success) {
        res.status(400).json({ error: 'Invalid scan request', details: parsedResult.error.flatten() });
        return;
      }
      const parsed = parsedResult.data;
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
          const roots = parsed.roots;
          const exts = cfg.scanner.extensions;
          // Run scan
          const result = await service.run(roots, parsed.mode ?? 'auto', exts);
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
    } catch (err) {
      next(err);
    }
  });

  router.get('/status', (req, res) => {
    const id = String(req.query.scanId || '');
    const s = statuses.get(id);
    if (!s) {
      res.status(404).json({ error: 'Unknown scanId' });
      return;
    }
    const payload = scanStatusSchema.parse({ ...s });
    res.json(payload);
  });

  return router;
}


