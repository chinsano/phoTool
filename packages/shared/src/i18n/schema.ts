import { z } from 'zod';

/**
 * Language codes supported by the application
 */
export const SUPPORTED_LANGUAGES = {
  EN: 'en',
  DE: 'de',
} as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[keyof typeof SUPPORTED_LANGUAGES];

/**
 * Schema for individual UI text elements
 */
export const i18nTextSchema = z.object({
  label: z.string().min(1, 'Label cannot be empty'),
  hint: z.string().min(1, 'Hint cannot be empty').optional(),
  doc: z.string().min(1, 'Doc cannot be empty').optional(),
});

export type I18nText = z.infer<typeof i18nTextSchema>;

/**
 * Schema for UI element IDs
 * These should be kebab-case identifiers for UI elements
 */
export const uiElementIdSchema = z.string().regex(
  /^[a-z]([a-z0-9]+(-[a-z0-9]+)*)?$/,
  'UI element ID must be kebab-case (lowercase letters, numbers, and hyphens, starting with a letter)'
);

export type UIElementId = z.infer<typeof uiElementIdSchema>;

/**
 * Schema for a complete i18n file
 * Maps UI element IDs to their text content
 */
export const i18nFileSchema = z.record(uiElementIdSchema, i18nTextSchema);

export type I18nFile = z.infer<typeof i18nFileSchema>;

/**
 * Schema for language-specific i18n data
 */
export const languageI18nSchema = z.object({
  language: z.nativeEnum(SUPPORTED_LANGUAGES),
  texts: i18nFileSchema,
});

export type LanguageI18n = z.infer<typeof languageI18nSchema>;

/**
 * Schema for the complete i18n matrix
 * Maps language codes to their i18n data
 */
export const i18nMatrixSchema = z.record(
  z.nativeEnum(SUPPORTED_LANGUAGES),
  i18nFileSchema
);

export type I18nMatrix = z.infer<typeof i18nMatrixSchema>;

/**
 * Schema for i18n request/response
 */
export const i18nRequestSchema = z.object({
  language: z.nativeEnum(SUPPORTED_LANGUAGES),
  uiElementIds: z.array(uiElementIdSchema).optional(),
});

export type I18nRequest = z.infer<typeof i18nRequestSchema>;

export const i18nResponseSchema = z.object({
  language: z.nativeEnum(SUPPORTED_LANGUAGES),
  texts: i18nFileSchema,
});

export type I18nResponse = z.infer<typeof i18nResponseSchema>;

/**
 * Utility functions for i18n validation
 */

/**
 * Validates that all required UI element IDs are present in all languages
 */
export function validateI18nCompleteness(matrix: I18nMatrix): {
  isValid: boolean;
  missing: Record<SupportedLanguage, UIElementId[]>;
  extra: Record<SupportedLanguage, UIElementId[]>;
} {
  const languages = Object.keys(matrix) as SupportedLanguage[];
  
        // Get element IDs for each language
        const languageElementIds: Record<SupportedLanguage, Set<UIElementId>> = {} as Record<SupportedLanguage, Set<UIElementId>>;
        languages.forEach(lang => {
          const langTexts = matrix[lang];
          languageElementIds[lang] = new Set(Object.keys(langTexts || {}) as UIElementId[]);
        });

  const missing: Record<SupportedLanguage, UIElementId[]> = {} as Record<SupportedLanguage, UIElementId[]>;
  const extra: Record<SupportedLanguage, UIElementId[]> = {} as Record<SupportedLanguage, UIElementId[]>;

  // Check each language for missing and extra IDs
  languages.forEach(lang => {
    const langElementIds = languageElementIds[lang];
    
    // Find IDs that exist in other languages but not in this language
    const otherLanguageIds = new Set<UIElementId>();
    languages.forEach(otherLang => {
      if (otherLang !== lang) {
        languageElementIds[otherLang].forEach(id => otherLanguageIds.add(id));
      }
    });
    
    // Missing: IDs that are in other languages but not in this language
    missing[lang] = Array.from(otherLanguageIds).filter(id => !langElementIds.has(id));
    
    // Extra: IDs that are in this language but not in any other language
    extra[lang] = Array.from(langElementIds).filter(id => !otherLanguageIds.has(id));
  });

  const isValid = Object.values(missing).every(arr => arr.length === 0) &&
                  Object.values(extra).every(arr => arr.length === 0);

  return { isValid, missing, extra };
}

/**
 * Gets text for a specific UI element in a specific language
 */
export function getI18nText(
  matrix: I18nMatrix,
  language: SupportedLanguage,
  uiElementId: UIElementId,
  fallbackLanguage: SupportedLanguage = SUPPORTED_LANGUAGES.EN
): I18nText | null {
  // Try requested language first
  if (matrix[language]?.[uiElementId]) {
    return matrix[language][uiElementId];
  }

  // Fall back to fallback language
  if (matrix[fallbackLanguage]?.[uiElementId]) {
    return matrix[fallbackLanguage][uiElementId];
  }

  return null;
}

/**
 * Creates a default i18n text object
 */
export function createDefaultI18nText(label: string, hint?: string, doc?: string): I18nText {
  return {
    label,
    ...(hint && { hint }),
    ...(doc && { doc }),
  };
}

/**
 * Creates a sample i18n matrix for testing
 */
export function createSampleI18nMatrix(): I18nMatrix {
  return {
    [SUPPORTED_LANGUAGES.EN]: {
      'app-title': createDefaultI18nText('phoTool', 'Photo management application'),
      'button-save': createDefaultI18nText('Save', 'Save changes'),
      'button-cancel': createDefaultI18nText('Cancel', 'Cancel operation'),
      'filter-builder': createDefaultI18nText('Filter Builder', 'Build complex filters'),
      'tag-library': createDefaultI18nText('Tag Library', 'Manage tags and groups'),
    },
    [SUPPORTED_LANGUAGES.DE]: {
      'app-title': createDefaultI18nText('phoTool', 'Foto-Verwaltungsanwendung'),
      'button-save': createDefaultI18nText('Speichern', 'Änderungen speichern'),
      'button-cancel': createDefaultI18nText('Abbrechen', 'Vorgang abbrechen'),
      'filter-builder': createDefaultI18nText('Filter-Builder', 'Komplexe Filter erstellen'),
      'tag-library': createDefaultI18nText('Tag-Bibliothek', 'Tags und Gruppen verwalten'),
    },
  };
}
