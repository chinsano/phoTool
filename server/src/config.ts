import fs from 'node:fs';
import path from 'node:path';
import { appConfigSchema, type AppConfig, defaultConfig } from '@phoTool/shared';

const ROOT_FILE = 'phoTool.config.json';

export function loadConfig(cwd: string = process.cwd()): AppConfig {
  const filePath = path.resolve(cwd, ROOT_FILE);
  if (!fs.existsSync(filePath)) return defaultConfig;
  const raw = fs.readFileSync(filePath, 'utf8');
  const json = JSON.parse(raw);
  return appConfigSchema.parse(json);
}


