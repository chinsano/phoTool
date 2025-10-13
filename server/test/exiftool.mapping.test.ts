import { describe, it, expect } from 'vitest';

import { fromHierarchicalSubjectStrings, toHierarchicalSubjectStrings, normalizeSubjects } from '../src/services/exiftool/mapping.js';

describe('exiftool mapping utils', () => {
  it('normalizes subjects', () => {
    expect(normalizeSubjects([' A ', '', 'B'])).toEqual(['A', 'B']);
    expect(normalizeSubjects(null)).toEqual([]);
  });

  it('converts hierarchical subjects to strings and back', () => {
    const paths = [['People', 'Family', 'Alice'], ['Travel', '2024']];
    const strings = toHierarchicalSubjectStrings(paths);
    expect(strings).toEqual(['People|Family|Alice', 'Travel|2024']);
    const round = fromHierarchicalSubjectStrings(strings);
    expect(round).toEqual(paths);
  });
});


