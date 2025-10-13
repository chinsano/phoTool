import { describe, it, expect } from 'vitest';

import { expandFromTakenAt } from '../src/services/placeholders/date.js';

describe('expandFromTakenAt', () => {
  it('returns empty for null/undefined/invalid', () => {
    expect(expandFromTakenAt(undefined)).toEqual({});
    expect(expandFromTakenAt(null)).toEqual({});
    expect(expandFromTakenAt('not-a-date')).toEqual({});
  });

  it('produces deterministic UTC-based expansions', () => {
    // 2023-03-05T23:30:00-05:00 corresponds to 2023-03-06T04:30:00Z
    const iso = '2023-03-05T23:30:00-05:00';
    const e = expandFromTakenAt(iso);
    expect(e.year).toBe('2023');
    expect(e.month).toBe('2023-03');
    expect(e.day).toBe('2023-03-06');
    expect(e.weekday).toBe('Mon'); // 2023-03-06 is Monday in UTC
  });

  it('handles leap day', () => {
    const iso = '2020-02-29T12:00:00Z';
    const e = expandFromTakenAt(iso);
    expect(e.year).toBe('2020');
    expect(e.month).toBe('2020-02');
    expect(e.day).toBe('2020-02-29');
    expect(e.weekday).toBe('Sat');
  });
});


