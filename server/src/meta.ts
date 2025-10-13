import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.resolve(__dirname, '../package.json');

let pkgName = '@phoTool/server';
let pkgVersion = '0.0.0';

try {
  const raw = fs.readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(raw) as { name?: string; version?: string };
  if (pkg.name) pkgName = pkg.name;
  if (pkg.version) pkgVersion = pkg.version;
} catch {
  // ignore and use defaults
}

export const appMeta = { name: pkgName, version: pkgVersion };


