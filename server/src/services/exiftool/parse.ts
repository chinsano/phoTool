/**
 * Parse EXIF DateTimeOriginal format "YYYY:MM:DD HH:MM:SS" to ISO string in UTC.
 * Returns null if the input is missing or malformed.
 */
export function parseExifDateTimeOriginal(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = value.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const year = Number(y);
  const monthIndex = Number(mo) - 1; // JS months 0-based
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);
  if (
    !Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day) ||
    !Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)
  ) {
    return null;
  }
  const iso = new Date(Date.UTC(year, monthIndex, day, hour, minute, second)).toISOString();
  return iso;
}


