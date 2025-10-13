import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

import { loadConfig } from '../src/config.js';

function withTempDir(run: (dir: string) => void) {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync.native(process.cwd()), 'tmp-gc-'));
  try { run(dir); } finally {
    // keep temp for inspection if needed
  }
}

describe('config geocoder defaults and overrides', () => {
  it('has sensible defaults when missing', () => {
    withTempDir((dir) => {
      const cfg = loadConfig(dir);
      expect(cfg.geocoder.enabled).toBe(true);
      expect(cfg.geocoder.precision).toBeGreaterThanOrEqual(0);
      expect(cfg.geocoder.bigdatacloud.baseUrl).toBe('https://api.bigdatacloud.net/data/reverse-geocode-client');
      expect(cfg.geocoder.bigdatacloud.timeoutMs).toBeGreaterThan(0);
      expect(cfg.geocoder.bigdatacloud.retries).toBeGreaterThanOrEqual(0);
    });
  });

  it('parses overrides from config file', () => {
    withTempDir((dir) => {
      const file = path.join(dir, 'phoTool.config.json');
      fs.writeFileSync(
        file,
        JSON.stringify({
          geocoder: {
            enabled: false,
            precision: 4,
            bigdatacloud: {
              baseUrl: 'https://custom-api.example.com',
              timeoutMs: 10000,
              retries: 5,
            },
          },
        }),
        'utf8'
      );
      const cfg = loadConfig(dir);
      expect(cfg.geocoder.enabled).toBe(false);
      expect(cfg.geocoder.precision).toBe(4);
      expect(cfg.geocoder.bigdatacloud.baseUrl).toBe('https://custom-api.example.com');
      expect(cfg.geocoder.bigdatacloud.timeoutMs).toBe(10000);
      expect(cfg.geocoder.bigdatacloud.retries).toBe(5);
    });
  });
});


