import type { PlaceholderResolverPort } from '@phoTool/shared';
import { inArray } from 'drizzle-orm';

import { reverseGeocodeBigDataCloud } from './bigdatacloudGeocoder.js';
import { expandFromTakenAt } from './date.js';
import { extractLocationFromExifText } from './locationFromExif.js';
import { db } from '../../db/client.js';
import { files } from '../../db/schema/files.js';
import { logger } from '../../logger.js';

function buildTagsFromDate(date: ReturnType<typeof expandFromTakenAt>): string[] {
  const out: string[] = [];
  if (date.year) out.push(`Year ${date.year}`);
  if (date.month) out.push(`Month ${date.month}`);
  if (date.day) out.push(`Day ${date.day}`);
  if (date.weekday) out.push(`Weekday ${date.weekday}`);
  return out;
}

function buildTagsFromLocation(loc: { country?: string | undefined; state?: string | undefined; city?: string | undefined }): string[] {
  const out: string[] = [];
  if (loc.country) out.push(`Country ${loc.country}`);
  if (loc.state) out.push(`State ${loc.state}`);
  if (loc.city) out.push(`City ${loc.city}`);
  return out;
}

export const placeholderResolverService: PlaceholderResolverPort = {
  async expand(req) {
    const rows = await db
      .select()
      .from(files)
      .where(inArray(files.id, req.fileIds));

    const expansions: Record<string, string[]> = {};

    for (const row of rows) {
      const tags: string[] = [];
      const date = expandFromTakenAt(row.takenAt ?? undefined);

      if (req.tokens.includes('year') || req.tokens.includes('month') || req.tokens.includes('day') || req.tokens.includes('weekday')) {
        tags.push(...buildTagsFromDate(date));
      }

      if (req.tokens.includes('country') || req.tokens.includes('state') || req.tokens.includes('city')) {
        // EXIF textual first (if mapper later provides fields)
        const exifText = extractLocationFromExifText({
          country: undefined,
          state: undefined,
          city: undefined,
        });

        let loc = exifText;

        if (!loc.country && !loc.state && !loc.city && row.lat !== null && row.lon !== null) {
          const online = await reverseGeocodeBigDataCloud(row.lat, row.lon).catch((err) => {
            logger.error({ error: err instanceof Error ? err.message : String(err), fileId: row.id }, 'BigDataCloud geocoder failed');
            return undefined;
          });
          if (online) {
            loc = { country: online.country, state: online.state, city: online.city };
          }
        }

        tags.push(...buildTagsFromLocation(loc));
      }

      expansions[String(row.id)] = tags;
    }

    return { expansions };
  },
};


