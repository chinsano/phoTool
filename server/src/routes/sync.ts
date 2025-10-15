import { Router } from 'express';

import { loadConfig } from '../config.js';
import { ValidationError } from '../errors.js';
import { logger } from '../logger.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ExifToolService } from '../services/exiftool/index.js';


export function createSyncRouter() {
  const router = Router();
  const cfg = loadConfig();
  const exif = new ExifToolService();
  void exif.start().catch((err) => logger.error({ err }, 'Failed to start ExifToolService'));

  // Manual import EXIF → DB (placeholder; hook into DB layer later)
  router.post('/import', asyncHandler(async (req, res) => {
    if (!cfg.sync.allowManualImport) {
      throw new ValidationError('Manual import disabled by configuration');
    }
    const { files } = req.body as { files: string[] };
    if (!Array.isArray(files) || files.length === 0) {
      throw new ValidationError('files[] required');
    }
    const results = [] as unknown[];
    for (const file of files) {
      const meta = await exif.readMetadata(file);
      // TODO: upsert into DB (tags, taken_at, gps, dimensions)
      results.push({ file, meta });
    }
    res.json({ imported: results.length, results });
  }));

  // Manual write DB → Sidecar/Embedded per config
  router.post('/write', asyncHandler(async (req, res) => {
    if (!cfg.sync.allowManualWrite) {
      throw new ValidationError('Manual write disabled by configuration');
    }
    const { file, subjects, hierarchical } = req.body as { file: string; subjects?: string[]; hierarchical?: string[][] };
    if (!file) {
      throw new ValidationError('file required');
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
  }));

  return router;
}

