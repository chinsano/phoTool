import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pino from 'pino';

const level = process.env.LOG_LEVEL || 'info';
const isProd = process.env.NODE_ENV === 'production';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logFile = path.resolve(__dirname, '../server.log');

// Multi-transport: pretty to console in dev, always write JSON to file
const targets: pino.TransportTargetOptions[] = [
  { target: 'pino/file', options: { destination: logFile }, level },
];
if (!isProd) {
  targets.unshift({
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard' },
    level,
  });
}

export const logger = pino(
  { level },
  pino.transport({ targets })
);


