import { type ScanMode } from '@phoTool/shared';
import { eq, inArray } from 'drizzle-orm';

import { computeSignature, diffAgainstDb, listFiles, normalizePaths, type ListedFile } from './fs.js';
import { db } from '../../db/client.js';
import { files, sources } from '../../db/schema/index.js';
import { logger } from '../../logger.js';

export interface ScanJobResult {
  added: number;
  updated: number;
  deleted: number;
}

export class ScannerService {
  run(roots: string[], mode: ScanMode, extensions: string[]) {
    const norm = normalizePaths(roots);
    const signature = computeSignature(norm);
    if (mode === 'auto') {
      // If same signature exists, skip
      return this.runIfChanged(norm, signature, extensions);
    }
    return this.performScan(norm, signature, extensions);
  }

  private async runIfChanged(roots: string[], signature: string, extensions: string[]) {
    const existing = await db
      .select({ signature: sources.signature })
      .from(sources)
      .where(eq(sources.signature, signature))
      .limit(1);
    if (existing.length > 0) {
      logger.info({ signature }, 'Scanner: signature unchanged; skipping');
      return { added: 0, updated: 0, deleted: 0 } satisfies ScanJobResult;
    }
    return this.performScan(roots, signature, extensions);
  }

  private async performScan(roots: string[], signature: string, extensions: string[]) {
    logger.info({ roots, signature }, 'Scanner: starting');
    const current = listFiles(roots, extensions);
    // Snapshot from DB
    const dbRows = await db.select({ path: files.path, size: files.size, mtime: files.mtime, xmpMtime: files.xmpMtime }).from(files);
    const { adds, updates, deletes } = diffAgainstDb(current, dbRows);

    await this.applyAdds(adds);
    await this.applyUpdates(updates);
    await this.applyDeletes(deletes.map((d) => d.path));
    await this.upsertSource(signature, roots);

    const result: ScanJobResult = { added: adds.length, updated: updates.length, deleted: deletes.length };
    logger.info({ result }, 'Scanner: completed');
    return result;
  }

  private async applyAdds(adds: ListedFile[]) {
    for (const f of adds) {
      await db.insert(files).values({
        path: f.path,
        dir: f.dir,
        name: f.name,
        ext: f.ext,
        size: f.size,
        mtime: f.mtime,
        ctime: f.mtime,
        xmpPath: f.xmpPath,
        xmpMtime: f.xmpMtime,
        lastIndexedAt: new Date().toISOString(),
      }).onConflictDoNothing();
    }
  }

  private async applyUpdates(updates: ListedFile[]) {
    for (const f of updates) {
      await db.update(files).set({
        size: f.size,
        mtime: f.mtime,
        xmpPath: f.xmpPath,
        xmpMtime: f.xmpMtime,
        lastIndexedAt: new Date().toISOString(),
      }).where(eq(files.path, f.path));
    }
  }

  private async applyDeletes(paths: string[]) {
    if (paths.length === 0) return;
    await db.delete(files).where(inArray(files.path, paths));
  }

  private async upsertSource(signature: string, roots: string[]) {
    const now = new Date().toISOString();
    const rootsJson = JSON.stringify(roots);
    try {
      await db.insert(sources).values({ signature, rootsJson, lastScannedAt: now });
    } catch {
      await db.update(sources).set({ rootsJson, lastScannedAt: now }).where(eq(sources.signature, signature));
    }
  }
}


