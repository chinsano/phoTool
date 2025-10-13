export function toHierarchicalSubjectStrings(paths: string[][]): string[] {
  return paths.map((levels) => levels.map(String).join('|'));
}

export function fromHierarchicalSubjectStrings(values: string[] | undefined | null): string[][] {
  if (!Array.isArray(values)) return [];
  return values.map((v) => v.split('|').map((s) => s.trim()).filter(Boolean));
}

export function normalizeSubjects(subjects: string[] | undefined | null): string[] {
  if (!Array.isArray(subjects)) return [];
  return subjects.map((s) => s.trim()).filter(Boolean);
}
