import { describe, it, expect } from 'vitest';

import { extractLocationFromExifText } from '../src/services/placeholders/locationFromExif.js';

describe('extractLocationFromExifText', () => {
  it('normalizes casing and trims', () => {
    const r = extractLocationFromExifText({ country: '  united states  ', state: ' new YORK', city: ' new   york ' });
    expect(r.country).toBe('United States');
    expect(r.state).toBe('New York');
    expect(r.city).toBe('New York');
  });

  it('returns undefined for missing or empty fields', () => {
    const r = extractLocationFromExifText({});
    expect(r.country).toBeUndefined();
    expect(r.state).toBeUndefined();
    expect(r.city).toBeUndefined();
  });
});


