import { describe, it, expect } from 'vitest';

import { placeholderResolverService } from '../src/services/placeholders/index.js';

describe('placeholder expansions smoke', () => {
  it('returns stable outputs for the same input', async () => {
    const req: { fileIds: number[]; tokens: ('year'|'month'|'day'|'weekday'|'country'|'state'|'city')[] } = { fileIds: [], tokens: ['year', 'month', 'day', 'weekday'] };
    const out1 = await placeholderResolverService.expand(req);
    const out2 = await placeholderResolverService.expand(req);
    expect(JSON.stringify(out1)).toBe(JSON.stringify(out2));
  });
});
