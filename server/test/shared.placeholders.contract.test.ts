import { placeholderTokenSchema, expandPlaceholderRequestSchema, expandPlaceholderResponseSchema } from '@phoTool/shared';
import { describe, it, expect } from 'vitest';

describe('shared/contracts/placeholders', () => {
  it('parses valid request and enforces tokens', () => {
    const req = expandPlaceholderRequestSchema.parse({
      fileIds: [1, 2],
      tokens: ['year', 'country'],
    });
    expect(req.fileIds.length).toBe(2);
    const t = placeholderTokenSchema.parse('weekday');
    expect(t).toBe('weekday');
  });

  it('rejects invalid token', () => {
    expect(() => expandPlaceholderRequestSchema.parse({ fileIds: [1], tokens: ['__invalid__'] })).toThrow();
  });

  it('validates response shape', () => {
    const res = expandPlaceholderResponseSchema.parse({ expansions: { '1': ['Year 2023', 'Country GB'] } });
    expect(Array.isArray(res.expansions['1'])).toBe(true);
  });
});


