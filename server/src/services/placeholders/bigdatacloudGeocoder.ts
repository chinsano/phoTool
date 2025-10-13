import { eq, and } from 'drizzle-orm';

import { loadConfig } from '../../config.js';
import { db } from '../../db/client.js';
import { geoCache } from '../../db/schema/geoCache.js';
import { logger } from '../../logger.js';

export interface BigDataCloudGeocoderResult {
  country?: string | undefined;
  state?: string | undefined;
  city?: string | undefined;
  source: 'bigdatacloud';
}

interface BigDataCloudApiResponse {
  locality?: string;
  city?: string;
  principalSubdivision?: string;
  countryName?: string;
}

function roundCoord(value: number, precision: number): number {
  const p = Math.max(0, precision);
  const f = Math.pow(10, p);
  return Math.round(value * f) / f;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  options: { timeoutMs: number; retries: number }
): Promise<BigDataCloudApiResponse | undefined> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= options.retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as BigDataCloudApiResponse;
      return data;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      
      if (attempt < options.retries) {
        const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        logger.warn({ attempt, backoffMs, error: lastError.message }, 'BigDataCloud API request failed, retrying');
        await sleep(backoffMs);
      }
    }
  }

  logger.error({ error: lastError?.message }, 'BigDataCloud API request failed after all retries');
  return undefined;
}

export async function reverseGeocodeBigDataCloud(
  lat: number,
  lon: number,
  opts?: { precision?: number }
): Promise<BigDataCloudGeocoderResult | undefined> {
  const config = loadConfig();
  const precision = opts?.precision ?? config.geocoder.precision;
  const latRounded = roundCoord(lat, precision);
  const lonRounded = roundCoord(lon, precision);

  // 1) cache lookup
  const cached = db
    .select()
    .from(geoCache)
    .where(
      and(
        eq(geoCache.latRounded, latRounded),
        eq(geoCache.lonRounded, lonRounded),
        eq(geoCache.precision, precision)
      )
    )
    .get?.();

  if (cached) {
    logger.debug({ lat: latRounded, lon: lonRounded, source: cached.source }, 'Geocoder cache hit');
    return {
      country: cached.country ?? undefined,
      state: cached.state ?? undefined,
      city: cached.city ?? undefined,
      source: 'bigdatacloud',
    };
  }

  // 2) check if geocoder is enabled
  if (!config.geocoder.enabled) {
    logger.debug('Geocoder disabled in config');
    return undefined;
  }

  // 3) call BigDataCloud API
  const url = `${config.geocoder.bigdatacloud.baseUrl}?latitude=${lat}&longitude=${lon}`;
  logger.debug({ lat, lon, url }, 'Calling BigDataCloud API');

  const apiResponse = await fetchWithRetry(url, {
    timeoutMs: config.geocoder.bigdatacloud.timeoutMs,
    retries: config.geocoder.bigdatacloud.retries,
  });

  if (!apiResponse) {
    return undefined;
  }

  // 4) map response to our format
  const result: BigDataCloudGeocoderResult = {
    country: apiResponse.countryName,
    state: apiResponse.principalSubdivision,
    city: apiResponse.city ?? apiResponse.locality,
    source: 'bigdatacloud',
  };

  // 5) write-through cache
  try {
    db.insert(geoCache)
      .values({
        latRounded,
        lonRounded,
        precision,
        country: result.country ?? null,
        state: result.state ?? null,
        city: result.city ?? null,
        source: 'bigdatacloud',
        updatedAt: new Date().toISOString(),
      })
      .run?.();

    logger.debug({ lat: latRounded, lon: lonRounded, result }, 'Geocoder result cached');
  } catch (err) {
    logger.error({ error: err instanceof Error ? err.message : String(err) }, 'Failed to cache geocoder result');
  }

  return result;
}

