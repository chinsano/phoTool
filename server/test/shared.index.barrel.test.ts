import { filterChainSchema, filesSearchRequestSchema, tagsAggregateRequestSchema, thumbnailRequestSchema } from '@phoTool/shared';
import { describe, it, expect } from 'vitest';

describe('shared/index barrel', () => {
  it('exports expected schemas', () => {
    expect(filterChainSchema).toBeDefined();
    expect(filesSearchRequestSchema).toBeDefined();
    expect(tagsAggregateRequestSchema).toBeDefined();
    expect(thumbnailRequestSchema).toBeDefined();
  });
});
