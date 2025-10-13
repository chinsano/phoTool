import type { FilterChain, TagsAggregateRequest, TagsAggregateResponse } from '@phoTool/shared';

import { db as defaultDb } from '../db/client.js';
import { files } from '../db/schema/files.js';
import { fileTags } from '../db/schema/fileTags.js';

interface Db {
  select: typeof defaultDb.select;
}

function evaluateNode(fileIdToTagIds: Map<number, Set<number>>, node: FilterChain['start']): Set<number> {
  const tagIds = node.tagIds.map((t) => Number(t));
  const result = new Set<number>();
  for (const [fileId, tags] of fileIdToTagIds) {
    if (tagIds.length === 0) {
      continue;
    }
    if (node.mode === 'any') {
      if (tagIds.some((t) => tags.has(t))) result.add(fileId);
    } else {
      let ok = true;
      for (const t of tagIds) {
        if (!tags.has(t)) { ok = false; break; }
      }
      if (ok) result.add(fileId);
    }
  }
  return result;
}

function evaluateFilterChain(fileIdToTagIds: Map<number, Set<number>>, chain: FilterChain): Set<number> {
  let acc = evaluateNode(fileIdToTagIds, chain.start);
  for (const link of chain.links) {
    const next = evaluateNode(fileIdToTagIds, link.node);
    const merged = new Set<number>();
    if (link.connector === 'and') {
      for (const id of acc) if (next.has(id)) merged.add(id);
    } else if (link.connector === 'or') {
      for (const id of acc) merged.add(id);
      for (const id of next) merged.add(id);
    } else {
      for (const id of acc) if (!next.has(id)) merged.add(id);
    }
    acc = merged;
  }
  return acc;
}

export class AggregationsService {
  constructor(private readonly db: Db = defaultDb) {}

  async countTags(request: TagsAggregateRequest): Promise<TagsAggregateResponse> {
    if (request.scope === 'selection') {
      return this.countForSelection(request.filter);
    }
    return this.countForSource(request.roots ?? []);
  }

  private async loadFileTagMap(): Promise<Map<number, Set<number>>> {
    const rows = await this.db.select().from(fileTags);
    const map = new Map<number, Set<number>>();
    for (const r of rows) {
      const set = map.get(r.fileId) ?? new Set<number>();
      set.add(r.tagId);
      map.set(r.fileId, set);
    }
    return map;
  }

  private async countForSelection(filter: FilterChain): Promise<TagsAggregateResponse> {
    const fileTagMap = await this.loadFileTagMap();
    const selected = evaluateFilterChain(fileTagMap, filter);
    const counts = new Map<number, number>();
    for (const [fileId, tagSet] of fileTagMap) {
      if (!selected.has(fileId)) continue;
      for (const tagId of tagSet) {
        counts.set(tagId, (counts.get(tagId) ?? 0) + 1);
      }
    }
    return { counts: Array.from(counts, ([tagId, count]) => ({ tagId, count })) };
  }

  private async countForSource(roots: string[]): Promise<TagsAggregateResponse> {
    // Compute file ids under roots by dir prefix
    const fileRows = await this.db.select().from(files);
    const underRoots = new Set<number>();
    for (const f of fileRows) {
      if (roots.some((root) => f.dir.startsWith(root))) underRoots.add(f.id);
    }
    const fileTagMap = await this.loadFileTagMap();
    const counts = new Map<number, number>();
    for (const [fileId, tagSet] of fileTagMap) {
      if (!underRoots.has(fileId)) continue;
      for (const tagId of tagSet) {
        counts.set(tagId, (counts.get(tagId) ?? 0) + 1);
      }
    }
    return { counts: Array.from(counts, ([tagId, count]) => ({ tagId, count })) };
  }
}
