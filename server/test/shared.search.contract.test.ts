import { filesSearchRequestSchema } from '@phoTool/shared';
import { describe, it, expect } from 'vitest';

describe('shared/contracts/search', () => {
  it('applies defaults for sort and page', () => {
    const req = filesSearchRequestSchema.parse({
      filter: { start: { id: 'root', mode: 'any', tagIds: [] }, links: [] },
    });
    expect(req.sort?.by ?? 'takenAt').toBe('takenAt');
    expect(req.sort?.order ?? 'desc').toBe('desc');
    expect(req.page?.limit ?? 100).toBe(100);
    expect(req.page?.offset ?? 0).toBe(0);
  });

  it('rejects oversized limit and negative offset', () => {
    expect(() =>
      filesSearchRequestSchema.parse({
        filter: { start: { id: 'root', mode: 'any', tagIds: [] }, links: [] },
        page: { limit: 1000, offset: 0 },
      })
    ).toThrow();

    expect(() =>
      filesSearchRequestSchema.parse({
        filter: { start: { id: 'root', mode: 'any', tagIds: [] }, links: [] },
        page: { limit: 100, offset: -1 },
      })
    ).toThrow();
  });
});
