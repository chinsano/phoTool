import {
  i18nTextSchema,
  i18nFileSchema,
  languageI18nSchema,
  i18nMatrixSchema,
  i18nRequestSchema,
  i18nResponseSchema,
  uiElementIdSchema,
  SUPPORTED_LANGUAGES,
  validateI18nCompleteness,
  getI18nText,
  createDefaultI18nText,
  createSampleI18nMatrix,
  type I18nText,
  type I18nFile,
  type LanguageI18n,
  type I18nMatrix,
  type I18nRequest,
  type I18nResponse,
        type UIElementId,
} from '@phoTool/shared';
import { describe, it, expect } from 'vitest';

describe('I18n Schema', () => {
  describe('i18nTextSchema', () => {
    it('should validate valid text objects', () => {
      const validTexts: I18nText[] = [
        { label: 'Save' },
        { label: 'Save', hint: 'Save changes' },
        { label: 'Save', hint: 'Save changes', doc: 'Saves the current state' },
        { label: 'Cancel', doc: 'Cancels the operation' },
      ];

      validTexts.forEach(text => {
        expect(() => i18nTextSchema.parse(text)).not.toThrow();
        expect(i18nTextSchema.parse(text)).toEqual(text);
      });
    });

    it('should reject invalid text objects', () => {
      const invalidTexts = [
        {}, // Missing label
        { label: '' }, // Empty label
        { hint: 'Hint without label' }, // Missing label
        { label: 'Save', hint: '' }, // Empty hint (should be undefined instead)
        { label: 'Save', doc: '' }, // Empty doc (should be undefined instead)
      ];

      invalidTexts.forEach(text => {
        expect(() => i18nTextSchema.parse(text)).toThrow();
      });
    });
  });

  describe('uiElementIdSchema', () => {
    it('should validate valid UI element IDs', () => {
      const validIds: UIElementId[] = [
        'app-title' as UIElementId,
        'button-save' as UIElementId,
        'filter-builder' as UIElementId,
        'tag-library' as UIElementId,
        'file-list' as UIElementId,
        'search-input' as UIElementId,
        'modal-dialog' as UIElementId,
        'toolbar-item' as UIElementId,
        'menu-item-1' as UIElementId,
        'panel-header' as UIElementId,
      ];

      validIds.forEach(id => {
        expect(() => uiElementIdSchema.parse(id)).not.toThrow();
        expect(uiElementIdSchema.parse(id)).toBe(id);
      });
    });

    it('should reject invalid UI element IDs', () => {
      const invalidIds = [
        '', // Empty
        'App-Title', // Capital letters
        'app_title', // Underscores
        'app.title', // Dots
        'app title', // Spaces
        '-app-title', // Starts with hyphen
        'app-title-', // Ends with hyphen
        '123-app', // Starts with number
        'app--title', // Double hyphens
        'app-title!', // Special characters
      ];

      invalidIds.forEach(id => {
        expect(() => uiElementIdSchema.parse(id)).toThrow();
      });
    });
  });

  describe('i18nFileSchema', () => {
    it('should validate valid i18n files', () => {
      const validFile: I18nFile = {
        'app-title': { label: 'phoTool' },
        'button-save': { label: 'Save', hint: 'Save changes' },
        'button-cancel': { label: 'Cancel', doc: 'Cancel operation' },
        'filter-builder': { 
          label: 'Filter Builder', 
          hint: 'Build filters',
          doc: 'Create complex filter chains'
        },
      };

      expect(() => i18nFileSchema.parse(validFile)).not.toThrow();
      expect(i18nFileSchema.parse(validFile)).toEqual(validFile);
    });

    it('should reject invalid i18n files', () => {
      const invalidFiles = [
        {
          'App-Title': { label: 'phoTool' }, // Invalid ID
        },
        {
          'app-title': { label: '' }, // Invalid text
        },
        {
          'app-title': { hint: 'Hint without label' }, // Invalid text
        },
      ];

      invalidFiles.forEach(file => {
        expect(() => i18nFileSchema.parse(file)).toThrow();
      });
    });
  });

  describe('languageI18nSchema', () => {
    it('should validate valid language i18n objects', () => {
      const validLanguageI18n: LanguageI18n = {
        language: SUPPORTED_LANGUAGES.EN,
        texts: {
          'app-title': { label: 'phoTool' },
          'button-save': { label: 'Save' },
        },
      };

      expect(() => languageI18nSchema.parse(validLanguageI18n)).not.toThrow();
      expect(languageI18nSchema.parse(validLanguageI18n)).toEqual(validLanguageI18n);
    });

    it('should reject invalid language i18n objects', () => {
      const invalidLanguageI18n = [
        {
          language: 'invalid', // Invalid language
          texts: { 'app-title': { label: 'phoTool' } },
        },
        {
          texts: { 'app-title': { label: 'phoTool' } }, // Missing language
        },
        {
          language: SUPPORTED_LANGUAGES.EN,
          // Missing texts
        },
      ];

      invalidLanguageI18n.forEach(obj => {
        expect(() => languageI18nSchema.parse(obj)).toThrow();
      });
    });
  });

  describe('i18nMatrixSchema', () => {
    it('should validate valid i18n matrix', () => {
      const validMatrix: I18nMatrix = {
        [SUPPORTED_LANGUAGES.EN]: {
          'app-title': { label: 'phoTool' },
          'button-save': { label: 'Save' },
        },
        [SUPPORTED_LANGUAGES.DE]: {
          'app-title': { label: 'phoTool' },
          'button-save': { label: 'Speichern' },
        },
      };

      expect(() => i18nMatrixSchema.parse(validMatrix)).not.toThrow();
      expect(i18nMatrixSchema.parse(validMatrix)).toEqual(validMatrix);
    });

    it('should reject invalid i18n matrix', () => {
      const invalidMatrix = [
        {
          'invalid-lang': { 'app-title': { label: 'phoTool' } }, // Invalid language key
        },
        {
          [SUPPORTED_LANGUAGES.EN]: { 'App-Title': { label: 'phoTool' } }, // Invalid element ID
        },
        {
          [SUPPORTED_LANGUAGES.EN]: { 'app-title': { label: '' } }, // Invalid text
        },
      ];

      invalidMatrix.forEach(matrix => {
        expect(() => i18nMatrixSchema.parse(matrix)).toThrow();
      });
    });
  });

  describe('i18nRequestSchema', () => {
    it('should validate valid i18n requests', () => {
      const validRequests: I18nRequest[] = [
        { language: SUPPORTED_LANGUAGES.EN },
        { 
          language: SUPPORTED_LANGUAGES.DE, 
          uiElementIds: ['app-title', 'button-save'] 
        },
        { 
          language: SUPPORTED_LANGUAGES.EN, 
          uiElementIds: [] 
        },
      ];

      validRequests.forEach(request => {
        expect(() => i18nRequestSchema.parse(request)).not.toThrow();
        expect(i18nRequestSchema.parse(request)).toEqual(request);
      });
    });

    it('should reject invalid i18n requests', () => {
      const invalidRequests = [
        { language: 'invalid' }, // Invalid language
        { uiElementIds: ['app-title'] }, // Missing language
        { 
          language: SUPPORTED_LANGUAGES.EN, 
          uiElementIds: ['App-Title'] // Invalid element ID
        },
      ];

      invalidRequests.forEach(request => {
        expect(() => i18nRequestSchema.parse(request)).toThrow();
      });
    });
  });

  describe('i18nResponseSchema', () => {
    it('should validate valid i18n responses', () => {
      const validResponse: I18nResponse = {
        language: SUPPORTED_LANGUAGES.EN,
        texts: {
          'app-title': { label: 'phoTool' },
          'button-save': { label: 'Save' },
        },
      };

      expect(() => i18nResponseSchema.parse(validResponse)).not.toThrow();
      expect(i18nResponseSchema.parse(validResponse)).toEqual(validResponse);
    });

    it('should reject invalid i18n responses', () => {
      const invalidResponses = [
        { language: 'invalid', texts: {} }, // Invalid language
        { texts: {} }, // Missing language
        { language: SUPPORTED_LANGUAGES.EN }, // Missing texts
      ];

      invalidResponses.forEach(response => {
        expect(() => i18nResponseSchema.parse(response)).toThrow();
      });
    });
  });

  describe('utility functions', () => {
    describe('validateI18nCompleteness', () => {
      it('should validate complete i18n matrix', () => {
        const completeMatrix: I18nMatrix = {
          [SUPPORTED_LANGUAGES.EN]: {
            'app-title': { label: 'phoTool' },
            'button-save': { label: 'Save' },
            'button-cancel': { label: 'Cancel' },
          },
          [SUPPORTED_LANGUAGES.DE]: {
            'app-title': { label: 'phoTool' },
            'button-save': { label: 'Speichern' },
            'button-cancel': { label: 'Abbrechen' },
          },
        };

        const result = validateI18nCompleteness(completeMatrix);
        expect(result.isValid).toBe(true);
        expect(result.missing[SUPPORTED_LANGUAGES.EN]).toEqual([]);
        expect(result.missing[SUPPORTED_LANGUAGES.DE]).toEqual([]);
        expect(result.extra[SUPPORTED_LANGUAGES.EN]).toEqual([]);
        expect(result.extra[SUPPORTED_LANGUAGES.DE]).toEqual([]);
      });

      it('should detect missing translations', () => {
        const incompleteMatrix: I18nMatrix = {
          [SUPPORTED_LANGUAGES.EN]: {
            'app-title': { label: 'phoTool' },
            'button-save': { label: 'Save' },
            'button-cancel': { label: 'Cancel' },
          },
          [SUPPORTED_LANGUAGES.DE]: {
            'app-title': { label: 'phoTool' },
            'button-save': { label: 'Speichern' },
            // Missing 'button-cancel'
          },
        };

        const result = validateI18nCompleteness(incompleteMatrix);
        expect(result.isValid).toBe(false);
        expect(result.missing[SUPPORTED_LANGUAGES.DE]).toEqual(['button-cancel']);
        expect(result.extra[SUPPORTED_LANGUAGES.EN]).toEqual(['button-cancel']);
      });

      it('should detect extra translations', () => {
        const matrixWithExtra: I18nMatrix = {
          [SUPPORTED_LANGUAGES.EN]: {
            'app-title': { label: 'phoTool' },
            'button-save': { label: 'Save' },
          },
          [SUPPORTED_LANGUAGES.DE]: {
            'app-title': { label: 'phoTool' },
            'button-save': { label: 'Speichern' },
            'button-extra': { label: 'Extra' }, // Extra translation
          },
        };

        const result = validateI18nCompleteness(matrixWithExtra);
        expect(result.isValid).toBe(false);
        expect(result.extra[SUPPORTED_LANGUAGES.DE]).toEqual(['button-extra']);
        expect(result.missing[SUPPORTED_LANGUAGES.EN]).toEqual(['button-extra']);
      });
    });

    describe('getI18nText', () => {
      const testMatrix: I18nMatrix = {
        [SUPPORTED_LANGUAGES.EN]: {
          'app-title': { label: 'phoTool' },
          'button-save': { label: 'Save' },
        },
        [SUPPORTED_LANGUAGES.DE]: {
          'app-title': { label: 'phoTool' },
          'button-save': { label: 'Speichern' },
        },
      };

      it('should return text for requested language', () => {
        const text = getI18nText(testMatrix, SUPPORTED_LANGUAGES.DE, 'button-save');
        expect(text).toEqual({ label: 'Speichern' });
      });

      it('should fall back to fallback language', () => {
        const text = getI18nText(testMatrix, SUPPORTED_LANGUAGES.DE, 'button-save', SUPPORTED_LANGUAGES.EN);
        expect(text).toEqual({ label: 'Speichern' }); // Should still get German since it exists
      });

      it('should fall back when requested language missing', () => {
        // Remove German translation
        const matrixWithoutGerman = {
          ...testMatrix,
          [SUPPORTED_LANGUAGES.DE]: {},
        };

        const text = getI18nText(matrixWithoutGerman, SUPPORTED_LANGUAGES.DE, 'button-save', SUPPORTED_LANGUAGES.EN);
        expect(text).toEqual({ label: 'Save' }); // Should fall back to English
      });

      it('should return null when text not found in any language', () => {
        const text = getI18nText(testMatrix, SUPPORTED_LANGUAGES.EN, 'non-existent');
        expect(text).toBeNull();
      });
    });

    describe('createDefaultI18nText', () => {
      it('should create text with label only', () => {
        const text = createDefaultI18nText('Save');
        expect(text).toEqual({ label: 'Save' });
      });

      it('should create text with label and hint', () => {
        const text = createDefaultI18nText('Save', 'Save changes');
        expect(text).toEqual({ label: 'Save', hint: 'Save changes' });
      });

      it('should create text with all fields', () => {
        const text = createDefaultI18nText('Save', 'Save changes', 'Saves the current state');
        expect(text).toEqual({ 
          label: 'Save', 
          hint: 'Save changes', 
          doc: 'Saves the current state' 
        });
      });

      it('should omit undefined optional fields', () => {
        const text = createDefaultI18nText('Save', undefined, 'Documentation');
        expect(text).toEqual({ label: 'Save', doc: 'Documentation' });
        expect('hint' in text).toBe(false);
      });
    });

    describe('createSampleI18nMatrix', () => {
      it('should create a valid sample matrix', () => {
        const matrix = createSampleI18nMatrix();
        
        expect(() => i18nMatrixSchema.parse(matrix)).not.toThrow();
        expect(matrix[SUPPORTED_LANGUAGES.EN]).toBeDefined();
        expect(matrix[SUPPORTED_LANGUAGES.DE]).toBeDefined();
        expect(matrix[SUPPORTED_LANGUAGES.EN]?.['app-title' as UIElementId]).toBeDefined();
        expect(matrix[SUPPORTED_LANGUAGES.DE]?.['app-title' as UIElementId]).toBeDefined();
      });

      it('should have complete translations', () => {
        const matrix = createSampleI18nMatrix();
        const result = validateI18nCompleteness(matrix);
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty i18n files', () => {
      const emptyFile: I18nFile = {};
      expect(() => i18nFileSchema.parse(emptyFile)).not.toThrow();
    });

    it('should handle empty i18n matrix', () => {
      const emptyMatrix: I18nMatrix = {};
      expect(() => i18nMatrixSchema.parse(emptyMatrix)).not.toThrow();
    });

    it('should handle very long UI element IDs', () => {
      const longId = 'very-long-ui-element-id-with-many-hyphens-and-numbers-123';
      expect(() => uiElementIdSchema.parse(longId)).not.toThrow();
    });

    it('should handle text with special characters', () => {
      const textWithSpecialChars: I18nText = {
        label: 'Save & Continue',
        hint: 'Save changes and continue (Ctrl+S)',
        doc: 'Saves the current state and proceeds to the next step. Use Ctrl+S as a keyboard shortcut.',
      };
      expect(() => i18nTextSchema.parse(textWithSpecialChars)).not.toThrow();
    });
  });
});
