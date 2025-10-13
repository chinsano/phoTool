function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export interface DateExpansions {
  year?: string | undefined;
  month?: string | undefined; // YYYY-MM
  day?: string | undefined;   // YYYY-MM-DD
  weekday?: string | undefined; // Mon..Sun (English, locale-independent)
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function expandFromTakenAt(takenAt: string | null | undefined): DateExpansions {
  if (!takenAt) return {};
  const date = new Date(takenAt);
  if (Number.isNaN(date.getTime())) return {};

  // Use UTC to ensure determinism across environments
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1; // 0-based
  const d = date.getUTCDate();
  const w = date.getUTCDay(); // 0..6, 0 = Sun

  return {
    year: String(y),
    month: `${y}-${pad2(m)}`,
    day: `${y}-${pad2(m)}-${pad2(d)}`,
    weekday: WEEKDAYS[w],
  };
}


