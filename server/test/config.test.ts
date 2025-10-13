import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../src/config.js';

function withTempDir(run: (dir: string) => void) {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync.native(process.cwd()), 'tmp-cfg-'));
  try { run(dir); } finally {
    // leave temp for inspection in CI, or clean up if desired
  }
}

describe('config loader', () => {
  it('returns defaults when file missing', () => {
    withTempDir((dir) => {
      const cfg = loadConfig(dir);
      expect(cfg.logLevel).toBe('info');
      expect(cfg.defaultSourceDir).toBe('');
      expect(cfg.exiftool.taskTimeoutMs).toBeGreaterThan(0);
      expect(cfg.exif.writeMode).toBe('sidecar-only');
      expect(cfg.exif.readPreference).toBe('sidecar-first');
      expect(cfg.sync.autoImportOnSourceChange).toBe(false);
    });
  });

  it('parses values from phoTool.config.json', () => {
    withTempDir((dir) => {
      const file = path.join(dir, 'phoTool.config.json');
      fs.writeFileSync(file, JSON.stringify({
        defaultSourceDir: 'C:/Photos',
        logLevel: 'debug',
        exiftool: { taskTimeoutMs: 5000, maxConcurrent: 3 },
        exif: { writeMode: 'both', readPreference: 'embedded-first' },
        sync: { autoImportOnSourceChange: false, autoWriteOnTagChange: false, allowManualImport: true, allowManualWrite: true }
      }), 'utf8');
      const cfg = loadConfig(dir);
      expect(cfg.defaultSourceDir).toBe('C:/Photos');
      expect(cfg.logLevel).toBe('debug');
      expect(cfg.exiftool.taskTimeoutMs).toBe(5000);
      expect(cfg.exiftool.maxConcurrent).toBe(3);
      expect(cfg.exif.writeMode).toBe('both');
      expect(cfg.exif.readPreference).toBe('embedded-first');
      expect(cfg.sync.allowManualImport).toBe(true);
    });
  });
});
