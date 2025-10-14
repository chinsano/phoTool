import {
  uiStateSchema,
  selectionStateSchema,
  filterStateSchema,
  layoutStateSchema,
  preferencesStateSchema,
  createDefaultUiState,
  migrateUiState,
  type UiState,
  type SelectionState,
  type FilterState,
  type LayoutState,
  type PreferencesState,
} from '@phoTool/shared';
import { describe, it, expect } from 'vitest';

describe('UI State Contracts', () => {
  describe('selectionStateSchema', () => {
    it('should parse valid selection state', () => {
      const valid: SelectionState = {
        selectedFileIds: [1, 2, 3],
        lastSelectedId: 2,
      };
      
      const result = selectionStateSchema.parse(valid);
      expect(result).toEqual(valid);
    });

    it('should parse valid selection state with null lastSelectedId', () => {
      const valid: SelectionState = {
        selectedFileIds: [],
        lastSelectedId: null,
      };
      
      const result = selectionStateSchema.parse(valid);
      expect(result).toEqual(valid);
    });

    it('should reject invalid selection state', () => {
      const invalid = {
        selectedFileIds: ['not-a-number'],
        lastSelectedId: 'invalid',
      };
      
      expect(() => selectionStateSchema.parse(invalid)).toThrow();
    });

    it('should reject negative file IDs', () => {
      const invalid = {
        selectedFileIds: [-1, 0],
        lastSelectedId: null,
      };
      
      expect(() => selectionStateSchema.parse(invalid)).toThrow();
    });
  });

  describe('filterStateSchema', () => {
    it('should parse valid filter state', () => {
      const valid: FilterState = {
        activeChain: null,
        history: [],
      };
      
      const result = filterStateSchema.parse(valid);
      expect(result).toEqual(valid);
    });

    it('should parse filter state with history', () => {
      const valid: FilterState = {
        activeChain: { some: 'chain' },
        history: [{ chain1: 'data' }, { chain2: 'data' }],
      };
      
      const result = filterStateSchema.parse(valid);
      expect(result).toEqual(valid);
    });
  });

  describe('layoutStateSchema', () => {
    it('should parse valid layout state', () => {
      const valid: LayoutState = {
        activeView: 'list',
        panelSizes: { left: 300, right: 400 },
      };
      
      const result = layoutStateSchema.parse(valid);
      expect(result).toEqual(valid);
    });

    it('should accept all valid view types', () => {
      const views: LayoutState['activeView'][] = ['list', 'grid', 'map', 'stats'];
      
      views.forEach(view => {
        const valid: LayoutState = {
          activeView: view,
          panelSizes: {},
        };
        
        const result = layoutStateSchema.parse(valid);
        expect(result.activeView).toBe(view);
      });
    });

    it('should reject invalid view type', () => {
      const invalid = {
        activeView: 'invalid-view',
        panelSizes: {},
      };
      
      expect(() => layoutStateSchema.parse(invalid)).toThrow();
    });

    it('should reject negative panel sizes', () => {
      const invalid = {
        activeView: 'list',
        panelSizes: { left: -100 },
      };
      
      expect(() => layoutStateSchema.parse(invalid)).toThrow();
    });
  });

  describe('preferencesStateSchema', () => {
    it('should parse valid preferences state', () => {
      const valid: PreferencesState = {
        locale: 'en',
        theme: 'light',
      };
      
      const result = preferencesStateSchema.parse(valid);
      expect(result).toEqual(valid);
    });

    it('should accept all valid theme types', () => {
      const themes: PreferencesState['theme'][] = ['light', 'dark', 'auto'];
      
      themes.forEach(theme => {
        const valid: PreferencesState = {
          locale: 'en',
          theme,
        };
        
        const result = preferencesStateSchema.parse(valid);
        expect(result.theme).toBe(theme);
      });
    });

    it('should accept various locale formats', () => {
      const locales = ['en', 'en-US', 'de', 'de-DE', 'fr-CA'];
      
      locales.forEach(locale => {
        const valid: PreferencesState = {
          locale,
          theme: 'auto',
        };
        
        const result = preferencesStateSchema.parse(valid);
        expect(result.locale).toBe(locale);
      });
    });

    it('should reject invalid theme', () => {
      const invalid = {
        locale: 'en',
        theme: 'invalid-theme',
      };
      
      expect(() => preferencesStateSchema.parse(invalid)).toThrow();
    });

    it('should reject invalid locale format', () => {
      const invalid = {
        locale: 'x', // too short
        theme: 'light',
      };
      
      expect(() => preferencesStateSchema.parse(invalid)).toThrow();
    });
  });

  describe('uiStateSchema', () => {
    it('should parse valid complete UI state', () => {
      const valid: UiState = {
        version: 1,
        currentVersion: 1,
        migrations: [],
        selection: {
          selectedFileIds: [1, 2],
          lastSelectedId: 1,
        },
        filter: {
          activeChain: null,
          history: [],
        },
        layout: {
          activeView: 'grid',
          panelSizes: { main: 800 },
        },
        preferences: {
          locale: 'de',
          theme: 'dark',
        },
      };
      
      const result = uiStateSchema.parse(valid);
      expect(result).toEqual(valid);
    });

    it('should apply defaults for missing optional fields', () => {
      const minimal = {
        selection: {
          selectedFileIds: [],
          lastSelectedId: null,
        },
        filter: {
          activeChain: null,
          history: [],
        },
        layout: {
          activeView: 'list' as const,
          panelSizes: {},
        },
        preferences: {
          locale: 'en',
          theme: 'auto' as const,
        },
      };
      
      const result = uiStateSchema.parse(minimal);
      expect(result.version).toBe(1);
      expect(result.currentVersion).toBe(1);
      expect(result.migrations).toEqual([]);
    });

    it('should reject invalid UI state', () => {
      const invalid = {
        version: 'not-a-number',
        selection: 'not-an-object',
      };
      
      expect(() => uiStateSchema.parse(invalid)).toThrow();
    });
  });

  describe('createDefaultUiState', () => {
    it('should create valid default state', () => {
      const defaultState = createDefaultUiState();
      
      const result = uiStateSchema.parse(defaultState);
      expect(result).toEqual(defaultState);
    });

    it('should have expected default values', () => {
      const defaultState = createDefaultUiState();
      
      expect(defaultState.version).toBe(1);
      expect(defaultState.currentVersion).toBe(1);
      expect(defaultState.migrations).toEqual([]);
      expect(defaultState.selection.selectedFileIds).toEqual([]);
      expect(defaultState.selection.lastSelectedId).toBeNull();
      expect(defaultState.filter.activeChain).toBeNull();
      expect(defaultState.filter.history).toEqual([]);
      expect(defaultState.layout.activeView).toBe('list');
      expect(defaultState.layout.panelSizes).toEqual({});
      expect(defaultState.preferences.locale).toBe('en');
      expect(defaultState.preferences.theme).toBe('auto');
    });
  });

  describe('migrateUiState', () => {
    it('should migrate valid state (current version)', () => {
      const state = createDefaultUiState();
      
      const result = migrateUiState(state);
      expect(result).toEqual(state);
    });

    it('should handle unknown state structure', () => {
      const unknownState = { some: 'unknown', data: 123 };
      
      expect(() => migrateUiState(unknownState)).toThrow();
    });

    it('should preserve valid state through migration', () => {
      const state: UiState = {
        version: 1,
        currentVersion: 1,
        migrations: [],
        selection: {
          selectedFileIds: [5, 10],
          lastSelectedId: 5,
        },
        filter: {
          activeChain: { test: 'chain' },
          history: [{ old: 'chain' }],
        },
        layout: {
          activeView: 'stats',
          panelSizes: { sidebar: 250 },
        },
        preferences: {
          locale: 'fr',
          theme: 'light',
        },
      };
      
      const result = migrateUiState(state);
      expect(result).toEqual(state);
    });
  });
});
