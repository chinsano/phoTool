import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { computeSignature, diffAgainstDb, listFiles, normalizePaths, type DbSnapshotRow } from '../src/services/scanner/fs.js';

describe('scanner FS utilities', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'photool-fs-'));
    const img = path.join(tmpDir, 'img1.jpg');
    const xmp = path.join(tmpDir, 'img1.xmp');
    fs.writeFileSync(img, 'data');
    fs.writeFileSync(xmp, '<xmp/ >');
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('normalizes and signs roots', () => {
    const roots = normalizePaths([tmpDir, tmpDir]);
    expect(roots.length).toBe(1);
    const sig = computeSignature(roots);
    expect(sig).toMatch(/^[a-f0-9]{40}$/);
  });

  it('lists files with sidecar mtime', () => {
    const listed = listFiles([tmpDir], ['.jpg']);
    expect(listed.length).toBe(1);
    expect(listed[0].path.endsWith('img1.jpg')).toBe(true);
    expect(listed[0].xmpMtime).not.toBeNull();
  });

  it('diffs adds, updates, and deletes', () => {
    const listed1 = listFiles([tmpDir], ['.jpg']);
    const snap1: DbSnapshotRow[] = [];
    let diff = diffAgainstDb(listed1, snap1);
    expect(diff.adds.length).toBe(1);
    expect(diff.updates.length).toBe(0);
    expect(diff.deletes.length).toBe(0);

    // simulate prior snapshot equals current -> no changes
    const snap2: DbSnapshotRow[] = listed1.map((f) => ({ path: f.path, size: f.size, mtime: f.mtime, xmpMtime: f.xmpMtime }));
    diff = diffAgainstDb(listed1, snap2);
    expect(diff.adds.length).toBe(0);
    expect(diff.updates.length).toBe(0);
    expect(diff.deletes.length).toBe(0);

    // touch file -> update
    const img = path.join(tmpDir, 'img1.jpg');
    const now = new Date();
    fs.utimesSync(img, now, new Date(now.getTime() + 1000));
    const listed2 = listFiles([tmpDir], ['.jpg']);
    diff = diffAgainstDb(listed2, snap2);
    expect(diff.updates.length).toBe(1);

    // delete file from FS -> delete (compare DB has entry)
    fs.rmSync(img);
    const listed3 = listFiles([tmpDir], ['.jpg']);
    diff = diffAgainstDb(listed3, snap2);
    expect(diff.deletes.length).toBe(1);
  });
});


