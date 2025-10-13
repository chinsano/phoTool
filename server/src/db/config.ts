import fs from 'node:fs';
import path from 'node:path';

export function getDatabaseFilePath(): string {
  const explicit = process.env.DB_FILE_PATH;
  if (explicit && explicit.trim().length > 0) {
    ensureDirectory(path.dirname(explicit));
    return explicit;
  }
  const dataDir = path.resolve(process.cwd(), 'data');
  ensureDirectory(dataDir);
  return path.join(dataDir, 'phoTool.db');
}

function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}


