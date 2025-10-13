import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import { describe, it, expect, beforeAll, vi } from 'vitest';

import { files } from '../src/db/schema/files.js';
import * as locationFromExif from '../src/services/placeholders/locationFromExif.js';
import * as offline from '../src/services/placeholders/offlineGeocoder.js';

vi.mock('../src/db/client.js', async () => {
  const Database = (await import('better-sqlite3')).default;
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const sqlite = new Database(':memory:');
  const memdb = drizzle(sqlite);
  return { db: memdb };
});

let resolver: { expand: (req: { fileIds: number[]; tokens: ('year'|'month'|'day'|'weekday'|'country'|'state'|'city')[] }) => Promise<{ expansions: Record<string, string[]> }> };
let db: BetterSQLite3Database;

describe('PlaceholderResolver precedence', () => {
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle');

  beforeAll(async () => {
    ({ db } = await import('../src/db/client.js'));
    await migrate(db, { migrationsFolder });
    await db.insert(files).values({ path: 'C:/p/a.jpg', dir: 'C:/p', name: 'a', ext: 'jpg', size: 1, mtime: 1, ctime: 1, takenAt: '2023-01-02T03:04:05Z', lat: 51.5, lon: -0.12 });
    const mod = await import('../src/services/placeholders/index.js');
    resolver = mod.placeholderResolverService;
  });

  it('uses EXIF textual fields first when available', async () => {
    vi.spyOn(locationFromExif, 'extractLocationFromExifText').mockReturnValue({ country: 'United Kingdom' });
    const out = await resolver.expand({ fileIds: [1], tokens: ['country'] });
    expect(out.expansions['1']).toContain('Country United Kingdom');
    // Ensure offline geocoder not called when EXIF is present
    const offlineSpy = vi.spyOn(offline, 'reverseGeocodeOffline');
    expect(offlineSpy).not.toHaveBeenCalled();
  });

  it('falls back to offline when EXIF text missing', async () => {
    vi.spyOn(offline, 'reverseGeocodeOffline').mockResolvedValue({ country: 'United Kingdom', source: 'offline' });
    const out = await resolver.expand({ fileIds: [1], tokens: ['country'] });
    expect(out.expansions['1']).toContain('Country United Kingdom');
  });
});


