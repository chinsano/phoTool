import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pinoHttp from 'pino-http';

import { logger } from './logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createAggregationsRouter } from './routes/aggregations.js';
import { createFilesRouter } from './routes/files.js';
import { createHealthRouter } from './routes/health.js';
import { createTagsRouter } from './routes/tags.js';
import { createTagGroupsRouter } from './routes/tagGroups.js';
import { createFileTagsRouter } from './routes/fileTags.js';
import { createLibraryRouter } from './routes/library.js';
import { createScanRouter } from './routes/scan.js';
import { createSyncRouter } from './routes/sync.js';
import { createThumbnailsRouter } from './routes/thumbnails.js';
import { createTagsRouter } from './routes/tags.js';
import { createTagGroupsRouter } from './routes/tagGroups.js';
import { createFileTagsRouter } from './routes/fileTags.js';
import { createLibraryRouter } from './routes/library.js';

export function createApp(options?: { port?: number }) {
  const app = express();

  const portForLogs = options?.port ?? Number(process.env.PORT || 5000);
  app.use(pinoHttp({
    logger,
    customProps: () => ({ port: portForLogs })
  }));
  app.use(express.json());

  app.use('/api/health', createHealthRouter());
  app.use('/api/sync', createSyncRouter());
  app.use('/api/scan', createScanRouter());
  app.use('/api/files', createFilesRouter());
  app.use('/api/files', createThumbnailsRouter());
  app.use('/api/files', createFileTagsRouter());
  app.use('/api/library', createLibraryRouter());
  app.use('/api/tags', createTagsRouter());
  app.use('/api/tag-groups', createTagGroupsRouter());
  // Preferred mount for aggregations
  app.use('/api/aggregations', createAggregationsRouter());
  // Temporary alias for backward compatibility
  app.use('/api/tags', createAggregationsRouter());

  // Unknown API routes → JSON 404
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });

  // Static web serving if built assets exist; otherwise friendly message
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const distPath = path.resolve(__dirname, '../../web/dist');
  if (process.env.SERVE_STATIC !== 'false') {
    app.use(express.static(distPath));
  }

  app.get('/', (_req, res) => {
    // If index.html exists, let static handler serve it, otherwise show info
    const indexPath = path.join(distPath, 'index.html');
    if (process.env.SERVE_STATIC !== 'false' && fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
      return;
    }
    res
      .type('text/plain')
      .send('phoTool server is running. Build the web app to serve UI (web/dist), or set SERVE_STATIC=false.');
  });

  app.use(errorHandler);

  return app;
}


