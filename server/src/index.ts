import { createServer } from 'node:http';

import { createApp } from './app.js';
import { logger } from './logger.js';

const PORT = Number(process.env.PORT || 5000);

const app = createApp({ port: PORT });
const server = createServer(app);

server.listen(PORT, '127.0.0.1', () => {
  logger.info({ port: PORT }, 'Server started');
});


