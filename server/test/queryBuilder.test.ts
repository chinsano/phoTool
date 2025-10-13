import type { FilterChain } from '@phoTool/shared';
import { describe, it, expect } from 'vitest';

import { buildFilterChainQuery } from '../src/services/queryBuilder.js';

describe('queryBuilder', () => {
  it('builds a single-node any query', () => {
    const chain: FilterChain = {
      start: { id: 'root', mode: 'any', tagIds: ['1', '2'] },
      links: [],
    };
    const { sql } = buildFilterChainQuery(chain);
    expect(sql).toContain('WITH node_0 AS');
    expect(sql).toContain('GROUP BY ft0.file_id');
    expect(sql).toContain('SELECT file_id FROM node_0');
  });

  it('builds a single-node all query', () => {
    const chain: FilterChain = {
      start: { id: 'root', mode: 'all', tagIds: ['3', '4', '5'] },
      links: [],
    };
    const { sql } = buildFilterChainQuery(chain);
    expect(sql).toContain('HAVING COUNT(DISTINCT ft0.tag_id) = 3');
  });

  it('combines nodes with and/or/and-not using set operations', () => {
    const chain: FilterChain = {
      start: { id: 'root', mode: 'any', tagIds: ['1'] },
      links: [
        { connector: 'and', node: { id: 'n1', mode: 'any', tagIds: ['2'] } },
        { connector: 'or', node: { id: 'n2', mode: 'any', tagIds: ['3'] } },
        { connector: 'and-not', node: { id: 'n3', mode: 'any', tagIds: ['4'] } },
      ],
    };
    const { sql } = buildFilterChainQuery(chain);
    expect(sql).toMatch(/\) INTERSECT SELECT file_id FROM node_1/);
    expect(sql).toMatch(/\) UNION SELECT file_id FROM node_2/);
    expect(sql).toMatch(/\) EXCEPT SELECT file_id FROM node_3/);
  });
});
