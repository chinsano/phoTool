import { filterChainSchema } from '@phoTool/shared';
import { describe, it, expect } from 'vitest';

describe('shared/filters schema', () => {
  it('accepts a basic chain and fills defaults', () => {
    const parsed = filterChainSchema.parse({
      start: { id: 'root', mode: 'any', tagIds: [] },
      links: [],
    });
    expect(parsed.links).toEqual([]);
    expect(parsed.start.mode).toBe('any');
  });

  it('rejects connector "none" inside links', () => {
    expect(() =>
      filterChainSchema.parse({
        start: { id: 'root', mode: 'any', tagIds: [] },
        links: [{ connector: 'none', node: { id: 'n1', mode: 'all', tagIds: [] } }],
      })
    ).toThrow();
  });

  it('rejects empty node id', () => {
    expect(() =>
      filterChainSchema.parse({
        start: { id: '', mode: 'all', tagIds: [] },
        links: [],
      })
    ).toThrow();
  });

  it('supports multiple links and preserves order', () => {
    const parsed = filterChainSchema.parse({
      start: { id: 'root', mode: 'any', tagIds: ['1'] },
      links: [
        { connector: 'and', node: { id: 'n1', mode: 'all', tagIds: ['2', '3'] } },
        { connector: 'or', node: { id: 'n2', mode: 'any', tagIds: ['4'] } },
        { connector: 'and-not', node: { id: 'n3', mode: 'any', tagIds: [] } },
      ],
    });
    expect(parsed.links.length).toBe(3);
    const [l0, l1, l2] = parsed.links;
    if (!l0 || !l1 || !l2) {
      throw new Error('expected three links');
    }
    expect(l0.connector).toBe('and');
    expect(l1.connector).toBe('or');
    expect(l2.connector).toBe('and-not');
  });
});
