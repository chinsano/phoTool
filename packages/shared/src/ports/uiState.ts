import type { UiState } from '../uiState.js';

export interface UiStatePort {
  /**
   * Get the current UI state
   */
  get(): Promise<UiState>;

  /**
   * Update the UI state with a partial update
   * @param partial - Partial state update
   */
  update(partial: Partial<UiState>): Promise<UiState>;

  /**
   * Reset the UI state to defaults
   */
  reset(): Promise<UiState>;
}
