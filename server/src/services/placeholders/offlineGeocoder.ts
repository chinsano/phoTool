import { eq, and } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { geoCache } from '../../db/schema/geoCache.js';

export interface OfflineGeocoderResult {
  country?: string | undefined;
  state?: string | undefined;
  city?: string | undefined;
  source: 'offline';
}

function roundCoord(value: number, precision: number): number {
  const p = Math.max(0, precision);
  const f = Math.pow(10, p);
  return Math.round(value * f) / f;
}

export async function reverseGeocodeOffline(
  lat: number,
  lon: number,
  opts?: { precision?: number }
): Promise<OfflineGeocoderResult | undefined> {
  const precision = opts?.precision ?? 3;
  const latRounded = roundCoord(lat, precision);
  const lonRounded = roundCoord(lon, precision);

  // 1) cache lookup
  const cached = db
    .select()
    .from(geoCache)
    .where(and(eq(geoCache.latRounded, latRounded), eq(geoCache.lonRounded, lonRounded), eq(geoCache.precision, precision)))
    .get?.();

  if (cached) {
    return {
      country: cached.country ?? undefined,
      state: cached.state ?? undefined,
      city: cached.city ?? undefined,
      source: 'offline',
    };
  }

  // 2) dataset disabled path
  const datasetEnabled = false; // placeholder; disabled by default until wired to config
  if (!datasetEnabled) return undefined;

  // 3) perform a minimal country-only stub
  // NOTE: Real implementation will use polygon lookup. Here we only return undefined
  const result: OfflineGeocoderResult | undefined = undefined as OfflineGeocoderResult | undefined;

  // 4) write-through cache when we have a result
  if (result) {
    db.insert(geoCache).values({
      latRounded,
      lonRounded,
      precision,
      country: result.country ?? null,
      state: result.state ?? null,
      city: result.city ?? null,
      source: 'offline',
      updatedAt: new Date().toISOString(),
    }).run?.();
  }

  return result;
}


