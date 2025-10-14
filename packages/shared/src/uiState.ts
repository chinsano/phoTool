import { z } from 'zod';

// UI State slice schemas
export const selectionStateSchema = z.object({
  selectedFileIds: z.array(z.number().int().positive()),
  lastSelectedId: z.number().int().positive().nullable(),
});

export const filterStateSchema = z.object({
  activeChain: z.any().nullable(), // FilterChain | null
  history: z.array(z.any()), // FilterChain[]
});

export const layoutStateSchema = z.object({
  activeView: z.enum(['list', 'grid', 'map', 'stats']),
  panelSizes: z.record(z.string(), z.number().int().positive()),
});

export const preferencesStateSchema = z.object({
  locale: z.string().min(2).max(5), // e.g., 'en', 'en-US', 'de', 'de-DE'
  theme: z.enum(['light', 'dark', 'auto']),
});

// Main UI state schema with versioning
export const uiStateSchema = z.object({
  version: z.number().int().positive().default(1),
  currentVersion: z.number().int().positive().default(1),
  migrations: z.array(z.string()).default([]),
  selection: selectionStateSchema,
  filter: filterStateSchema,
  layout: layoutStateSchema,
  preferences: preferencesStateSchema,
});

// Derived types
export type SelectionState = z.infer<typeof selectionStateSchema>;
export type FilterState = z.infer<typeof filterStateSchema>;
export type LayoutState = z.infer<typeof layoutStateSchema>;
export type PreferencesState = z.infer<typeof preferencesStateSchema>;
export type UiState = z.infer<typeof uiStateSchema>;

// Default state factory
export const createDefaultUiState = (): UiState => ({
  version: 1,
  currentVersion: 1,
  migrations: [],
  selection: {
    selectedFileIds: [],
    lastSelectedId: null,
  },
  filter: {
    activeChain: null, // Will be properly typed when FilterChain is available
    history: [],
  },
  layout: {
    activeView: 'list',
    panelSizes: {},
  },
  preferences: {
    locale: 'en',
    theme: 'auto',
  },
});

// Migration utilities (placeholder for future versions)
export const migrateUiState = (state: unknown): UiState => {
  // For now, just validate and return as-is
  // Future versions will implement actual migration logic
  return uiStateSchema.parse(state);
};
