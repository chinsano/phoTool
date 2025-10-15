import { createServer } from 'node:http';

import { createApp } from './app.js';
import { closeDatabase } from './db/client.js';
import { logger } from './logger.js';

const PORT = Number(process.env.PORT || 5000);
const SHUTDOWN_TIMEOUT = 10000; // 10 seconds

const app = createApp({ port: PORT });
const server = createServer(app);

let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn({ signal }, 'Shutdown already in progress, ignoring signal');
    return;
  }
  
  isShuttingDown = true;
  logger.info({ signal }, 'Shutdown initiated');

  // Stop accepting new connections
  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error closing HTTP server');
    } else {
      logger.info('HTTP server closed');
    }
  });

  // Set a timeout to force shutdown if graceful shutdown takes too long
  const shutdownTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  try {
    // Wait briefly for in-flight requests to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Close database connection
    try {
      closeDatabase();
      logger.info('Database connection closed');
    } catch (err) {
      logger.error({ err }, 'Error closing database');
    }

    logger.info('Shutdown complete');
    clearTimeout(shutdownTimer);
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    clearTimeout(shutdownTimer);
    process.exit(1);
  }
}

// Register signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

server.listen(PORT, '127.0.0.1', () => {
  logger.info({ port: PORT }, 'Server started');
});


