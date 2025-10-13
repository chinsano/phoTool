import type { FilesSearchRequest, FilesSearchResponse } from '@phoTool/shared';
import { sql } from 'drizzle-orm';

import { buildFilterChainQuery } from './queryBuilder.js';
import { db } from '../db/client.js';

type FileRowLite = {
  id: number;
  name: string;
  ext: string;
  takenAt: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
};

async function runRaw<T>(raw: ReturnType<typeof sql.raw>): Promise<T[]> {
  // Drizzle's .all typing lacks generics here; we assert to T[] at the boundary
  const result = await (db.all as unknown as (q: unknown) => Promise<unknown[]>)(raw);
  return result as T[];
}

export class QueryService {
  async searchFiles(req: FilesSearchRequest): Promise<FilesSearchResponse> {
    const { sql: selectionSql } = buildFilterChainQuery(req.filter);
    const sortBy = req.sort?.by ?? 'takenAt';
    const sortOrder = (req.sort?.order ?? 'desc').toUpperCase();
    const limit = req.page?.limit ?? 100;
    const offset = req.page?.offset ?? 0;

    const orderColumn = sortBy === 'name' ? 'name'
      : sortBy === 'size' ? 'size'
      : sortBy === 'mtime' ? 'mtime'
      : sortBy === 'id' ? 'id'
      : 'taken_at';

    const text = `WITH selection AS (${selectionSql})
      SELECT f.id, f.name, f.ext, f.taken_at as takenAt, f.width, f.height, f.duration
      FROM files f
      INNER JOIN selection s ON s.file_id = f.id
      ORDER BY ${orderColumn} ${sortOrder}
      LIMIT ${limit} OFFSET ${offset}`;

    const q = sql.raw(text);
    const rows = await runRaw<FileRowLite>(q);
    const items = rows.map((r) => ({
      id: r.id,
      name: r.name,
      ext: r.ext,
      takenAt: r.takenAt ?? null,
      width: typeof r.width === 'number' ? r.width : null,
      height: typeof r.height === 'number' ? r.height : null,
      duration: typeof r.duration === 'number' ? r.duration : null,
    }));
    return { items, page: { limit, offset, returned: items.length }, total: undefined };
  }
}
