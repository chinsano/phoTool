import { Router } from 'express';
import { HealthResponse } from '@phoTool/shared';
import { appMeta } from '../meta.js';

export function createHealthRouter() {
  const router = Router();
  router.get('/', (_req, res) => {
    const payload: HealthResponse = {
      ok: true,
      name: appMeta.name,
      version: appMeta.version,
    };
    // Validate against Zod schema before sending (defensive during early dev)
    const parse = HealthResponse.safeParse(payload);
    if (!parse.success) {
      res.status(500).json({ error: 'Invalid health payload' });
      return;
    }
    res.json(parse.data);
  });
  return router;
}


