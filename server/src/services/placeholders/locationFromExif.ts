export interface TextLocation {
  country?: string | undefined;
  state?: string | undefined;
  city?: string | undefined;
}

function normalizeToken(s: string | null | undefined): string | undefined {
  if (!s) return undefined;
  const trimmed = s.trim();
  if (!trimmed) return undefined;
  // Title Case basic ASCII words; leave non-letters as-is
  return trimmed
    .split(/\s+/)
    .map((w) => (w && w.length > 0 ? (w[0]!.toUpperCase() + w.slice(1).toLowerCase()) : w))
    .join(' ');
}

export function extractLocationFromExifText(fields: {
  country?: string | null | undefined;
  state?: string | null | undefined;
  city?: string | null | undefined;
}): TextLocation {
  return {
    country: normalizeToken(fields.country ?? undefined),
    state: normalizeToken(fields.state ?? undefined),
    city: normalizeToken(fields.city ?? undefined),
  };
}


