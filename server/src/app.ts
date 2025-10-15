import express from 'express';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pinoHttp from 'pino-http';

import { logger } from './logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter, expensiveLimiter } from './middleware/rateLimit.js';
import { createAggregationsRouter } from './routes/aggregations.js';
import { createAlbumsRouter } from './routes/albums.js';
import { createFilesRouter } from './routes/files.js';
import { createFileTagsRouter } from './routes/fileTags.js';
import { createHealthRouter } from './routes/health.js';
import { createLibraryRouter } from './routes/library.js';
import { placeholdersRouter } from './routes/placeholders.js';
import { createScanRouter } from './routes/scan.js';
import { createSyncRouter } from './routes/sync.js';
import { createTagGroupsRouter } from './routes/tagGroups.js';
import { createTagsRouter } from './routes/tags.js';
import { createThumbnailsRouter } from './routes/thumbnails.js';
import { createUiStateRouter } from './routes/uiState.js';

export function createApp(options?: { port?: number }) {
  const app = express();

  const portForLogs = options?.port ?? Number(process.env.PORT || 5000);
  app.use(pinoHttp({
    logger,
    customProps: () => ({ port: portForLogs })
  }));
  app.use(express.json());

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Allow data: and blob: for base64-encoded thumbnails
        imgSrc: ["'self'", "data:", "blob:"],
        // Allow inline scripts and styles for API responses (if needed)
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        // API-only server, no external resources needed
        connectSrc: ["'self'"],
      },
    },
    // Disable COEP for cross-origin resources (thumbnails, etc.)
    crossOriginEmbedderPolicy: false,
  }));

  // Rate limiting - apply specific expensive limiters BEFORE general limiter
  // This ensures expensive operations get their own lower limits
  app.use('/api/scan', expensiveLimiter);
  app.use('/api/expand-placeholder', expensiveLimiter);
  
  // General API rate limiter for all API routes
  app.use('/api', apiLimiter);

  app.use('/api/health', createHealthRouter());
  app.use('/api/sync', createSyncRouter());
  app.use('/api/scan', createScanRouter());
  app.use('/api/files', createFilesRouter());
  app.use('/api/files', createFileTagsRouter());
  app.use('/api/health', createHealthRouter());
  app.use('/api/library', createLibraryRouter());
  app.use('/api/tag-groups', createTagGroupsRouter());
  app.use('/api/tags', createTagsRouter());
  app.use('/api/files', createThumbnailsRouter());
  app.use('/api/albums', createAlbumsRouter());
  app.use('/api/state', createUiStateRouter());
  app.use(placeholdersRouter);
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


