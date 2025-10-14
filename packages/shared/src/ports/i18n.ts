import type { 
  SupportedLanguage, 
  UIElementId, 
  I18nText, 
  I18nFile, 
  I18nRequest, 
  I18nResponse 
} from '../i18n/schema.js';

/**
 * Port interface for internationalization (i18n) services
 */
export interface I18nPort {
  /**
   * Load i18n data for a specific language
   * @param language The language code to load
   * @returns Promise resolving to the i18n file for the language
   */
  loadLanguage(language: SupportedLanguage): Promise<I18nFile>;

  /**
   * Get text for a specific UI element in a specific language
   * @param uiElementId The UI element ID
   * @param language The language code
   * @param fallbackLanguage Optional fallback language (defaults to 'en')
   * @returns Promise resolving to the text object, or null if not found
   */
  getText(
    uiElementId: UIElementId, 
    language: SupportedLanguage, 
    fallbackLanguage?: SupportedLanguage
  ): Promise<I18nText | null>;

  /**
   * Get multiple texts for UI elements in a specific language
   * @param request The i18n request containing language and optional element IDs
   * @returns Promise resolving to the i18n response
   */
  getTexts(request: I18nRequest): Promise<I18nResponse>;

  /**
   * Get all available languages
   * @returns Promise resolving to array of supported language codes
   */
  getAvailableLanguages(): Promise<SupportedLanguage[]>;

  /**
   * Validate that all required UI element IDs are present in all languages
   * @returns Promise resolving to validation result
   */
  validateCompleteness(): Promise<{
    isValid: boolean;
    missing: Record<SupportedLanguage, UIElementId[]>;
    extra: Record<SupportedLanguage, UIElementId[]>;
  }>;

  /**
   * Reload i18n data from storage
   * Useful for development or when i18n files are updated
   * @returns Promise resolving when reload is complete
   */
  reload(): Promise<void>;
}
