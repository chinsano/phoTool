import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface ListedFile {
  path: string;
  dir: string;
  name: string;
  ext: string;
  size: number;
  mtime: number;
  xmpPath: string | null;
  xmpMtime: number | null;
}

export function normalizePaths(roots: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const r of roots) {
    const p = path.resolve(r);
    if (!seen.has(p)) {
      seen.add(p);
      normalized.push(p);
    }
  }
  normalized.sort();
  return normalized;
}

export function computeSignature(roots: string[]): string {
  const norm = normalizePaths(roots);
  const json = JSON.stringify(norm);
  return crypto.createHash('sha1').update(json).digest('hex');
}

function* walkDir(root: string): Generator<string> {
  const stack = [root];
  while (stack.length) {
    const current = stack.pop()!;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) {
        stack.push(full);
      } else if (e.isFile()) {
        yield full;
      }
    }
  }
}

export function listFiles(roots: string[], extensions: string[]): ListedFile[] {
  const out: ListedFile[] = [];
  const extSet = new Set(extensions.map((e) => e.toLowerCase()));
  for (const root of roots) {
    for (const filePath of walkDir(root)) {
      const ext = path.extname(filePath).toLowerCase();
      if (extensions.length && !extSet.has(ext)) continue;
      let stat: fs.Stats;
      try {
        stat = fs.statSync(filePath);
      } catch {
        continue;
      }
      const dir = path.dirname(filePath);
      const name = path.basename(filePath);
      const xmpPath = filePath.slice(0, filePath.length - ext.length) + '.xmp';
      let xmpStat: fs.Stats | null = null;
      try {
        xmpStat = fs.statSync(xmpPath);
      } catch {
        xmpStat = null;
      }
      out.push({
        path: filePath,
        dir,
        name,
        ext,
        size: stat.size,
        mtime: Math.floor(stat.mtimeMs),
        xmpPath: xmpStat ? xmpPath : null,
        xmpMtime: xmpStat ? Math.floor(xmpStat.mtimeMs) : null,
      });
    }
  }
  return out;
}

export interface DbSnapshotRow {
  path: string;
  size: number;
  mtime: number;
  xmpMtime: number | null;
}

export function diffAgainstDb(current: ListedFile[], dbRows: DbSnapshotRow[]) {
  const byPath = new Map<string, ListedFile>();
  for (const f of current) byPath.set(f.path, f);
  const dbByPath = new Map<string, DbSnapshotRow>();
  for (const r of dbRows) dbByPath.set(r.path, r);

  const adds: ListedFile[] = [];
  const updates: ListedFile[] = [];
  const deletes: DbSnapshotRow[] = [];

  for (const [p, f] of byPath) {
    const prev = dbByPath.get(p);
    if (!prev) {
      adds.push(f);
    } else if (prev.size !== f.size || prev.mtime !== f.mtime || prev.xmpMtime !== f.xmpMtime) {
      updates.push(f);
    }
  }
  for (const [p, r] of dbByPath) {
    if (!byPath.has(p)) deletes.push(r);
  }
  return { adds, updates, deletes };
}


