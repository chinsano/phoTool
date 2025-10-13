import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { ExifToolService } from '../src/services/exiftool/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, 'fixtures', 'exif');

function writeFixture(baseName: string): string {
  const b64 = fs.readFileSync(path.join(fixturesDir, `${baseName}.jpg.b64`), 'utf8');
  const buf = Buffer.from(b64, 'base64');
  const tmpDir = fs.mkdtempSync(path.join(fs.realpathSync.native(process.cwd()), 'tmp-exif-'));
  const jpgPath = path.join(tmpDir, `${baseName}.jpg`);
  fs.writeFileSync(jpgPath, buf);
  return jpgPath;
}

describe('exiftool integration (sidecar write/read)', () => {
  const svc = new ExifToolService();
  beforeAll(async () => {
    await svc.start();
  });
  afterAll(async () => {
    await svc.stop();
  });

  it('writes and reads subjects and hierarchical subjects via sidecar', async () => {
    const jpg = writeFixture('img1');
    const subjects = ['Cat', 'Home'];
    const paths = [['People', 'Family', 'Alice']];
    await svc.writeSubjects(jpg, subjects);
    await svc.writeHierarchicalSubjects(jpg, paths);
    const meta = await svc.readMetadata(jpg);
    expect(meta.subjects).toEqual(subjects);
    expect(meta.hierarchicalSubjects).toEqual(paths);
  });

  it('writes and reads embedded subjects and hierarchical subjects', async () => {
    const jpg = writeFixture('img1');
    const subjects = ['Dog', 'Park'];
    const paths = [['Trips', '2025']];
    await svc.writeEmbeddedSubjects(jpg, subjects);
    await svc.writeEmbeddedHierarchicalSubjects(jpg, paths);
    const meta = await svc.readMetadata(jpg);
    // readMetadata will pick sidecar if present; for this case there is none, so embedded should be visible
    expect(meta.subjects).toEqual(subjects);
    expect(meta.hierarchicalSubjects).toEqual(paths);
  });
});


