import { thumbnailRequestSchema } from '@phoTool/shared';
import { describe, it, expect } from 'vitest';

describe('shared/contracts/thumbnails', () => {
  it('applies defaults', () => {
    const parsed = thumbnailRequestSchema.parse({});
    expect(parsed.size).toBeGreaterThan(0);
    expect(parsed.format).toBeTypeOf('string');
  });

  it('rejects invalid size and format', () => {
    expect(() => thumbnailRequestSchema.parse({ size: 0 })).toThrow();
    expect(() => thumbnailRequestSchema.parse({ size: -1 })).toThrow();
    expect(() => thumbnailRequestSchema.parse({ format: 'gif' })).toThrow();
  });
});
