import { tagsAggregateRequestSchema } from '@phoTool/shared';
import { describe, it, expect } from 'vitest';

describe('shared/contracts/aggregations', () => {
  it('requires filter for selection scope', () => {
    expect(() =>
      tagsAggregateRequestSchema.parse({ scope: 'selection' })
    ).toThrow();
  });

  it('accepts selection with filter', () => {
    const parsed = tagsAggregateRequestSchema.parse({
      scope: 'selection',
      filter: { start: { id: 'root', mode: 'any', tagIds: [] }, links: [] },
    });
    expect(parsed.scope).toBe('selection');
  });

  it('requires roots or sourceSignature for source scope', () => {
    expect(() =>
      tagsAggregateRequestSchema.parse({ scope: 'source' })
    ).toThrow();
  });

  it('accepts source with roots', () => {
    const parsed = tagsAggregateRequestSchema.parse({
      scope: 'source',
      roots: ['C:/media'],
    });
    expect(parsed.scope).toBe('source');
  });

  it('accepts source with signature', () => {
    const parsed = tagsAggregateRequestSchema.parse({
      scope: 'source',
      sourceSignature: 'abc123',
    });
    expect(parsed.scope).toBe('source');
  });
});
