import { HealthResponse } from '@phoTool/shared';
import { Router } from 'express';

import { InternalError } from '../errors.js';
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
      throw new InternalError('Invalid health payload', { errors: parse.error.flatten() });
    }
    res.json(parse.data);
  });
  return router;
}


