import { Router } from 'express';
import { loadConfig } from '../config.js';
import { ExifToolService } from '../services/exiftool/index.js';
import { logger } from '../logger.js';

export function createSyncRouter() {
  const router = Router();
  const cfg = loadConfig();
  const exif = new ExifToolService();
  void exif.start().catch((err) => logger.error({ err }, 'Failed to start ExifToolService'));

  // Manual import EXIF → DB (placeholder; hook into DB layer later)
  router.post('/import', async (req, res, next) => {
    try {
      if (!cfg.sync.allowManualImport) {
        res.status(403).json({ error: 'Manual import disabled by configuration' });
        return;
      }
      const { files } = req.body as { files: string[] };
      if (!Array.isArray(files) || files.length === 0) {
        res.status(400).json({ error: 'files[] required' });
        return;
      }
      const results = [] as unknown[];
      for (const file of files) {
        const meta = await exif.readMetadata(file);
        // TODO: upsert into DB (tags, taken_at, gps, dimensions)
        results.push({ file, meta });
      }
      res.json({ imported: results.length, results });
    } catch (err) {
      next(err);
    }
  });

  // Manual write DB → Sidecar/Embedded per config
  router.post('/write', async (req, res, next) => {
    try {
      if (!cfg.sync.allowManualWrite) {
        res.status(403).json({ error: 'Manual write disabled by configuration' });
        return;
      }
      const { file, subjects, hierarchical } = req.body as { file: string; subjects?: string[]; hierarchical?: string[][] };
      if (!file) {
        res.status(400).json({ error: 'file required' });
        return;
      }
      const toSubjects = Array.isArray(subjects) ? subjects : [];
      const toHier = Array.isArray(hierarchical) ? hierarchical : [];

      if (cfg.exif.writeMode === 'embedded-only' || cfg.exif.writeMode === 'both') {
        if (toSubjects.length) await exif.writeEmbeddedSubjects(file, toSubjects);
        if (toHier.length) await exif.writeEmbeddedHierarchicalSubjects(file, toHier);
      }
      if (cfg.exif.writeMode === 'sidecar-only' || cfg.exif.writeMode === 'both') {
        if (toSubjects.length) await exif.writeSubjects(file, toSubjects);
        if (toHier.length) await exif.writeHierarchicalSubjects(file, toHier);
      }
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}


