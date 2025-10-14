import type { UiStatePort, UiState } from '@phoTool/shared';
import { uiStateSchema, createDefaultUiState } from '@phoTool/shared';
import path from 'node:path';
import { ZodError } from 'zod';

import { logger } from '../logger.js';
import { AtomicJsonStore } from '../utils/atomicJsonStore.js';

export class UiStateService implements UiStatePort {
  private readonly store: AtomicJsonStore<UiState>;
  private readonly filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath ?? process.env.UI_STATE_FILE_PATH ?? path.resolve(process.cwd(), 'data', 'ui-state.json');
    this.store = new AtomicJsonStore(this.filePath);
  }

  /**
   * Retrieves the current UI state.
   * If no state file exists, returns the default state.
   * If the file is corrupted, attempts to read from backups.
   */
  async get(): Promise<UiState> {
    try {
      const stateData = await this.store.read();
      
      if (!stateData) {
        logger.info({ filePath: this.filePath }, 'No UI state file found, returning default state');
        return createDefaultUiState();
      }

      // Validate the state data against the schema
      let validatedState;
      try {
        validatedState = uiStateSchema.parse(stateData);
      } catch (parseError) {
        logger.debug({ parseError: parseError instanceof Error ? parseError.message : String(parseError), parseErrorType: parseError instanceof Error ? parseError.constructor.name : typeof parseError, isZodError: parseError instanceof ZodError }, 'Parse error in get()');
        if (parseError instanceof ZodError || (parseError instanceof Error && parseError.name === 'ZodError')) {
          logger.warn({ parseError, filePath: this.filePath }, 'UI state file contains invalid data, returning default state');
          return createDefaultUiState();
        }
        throw parseError;
      }
      
      logger.debug({ filePath: this.filePath }, 'Retrieved UI state');
      return validatedState;
    } catch (error) {
      logger.debug({ error: error instanceof Error ? error.message : String(error), errorType: error instanceof Error ? error.constructor.name : typeof error }, 'Caught error in get()');
      if (error instanceof ZodError) {
        logger.warn({ error, filePath: this.filePath }, 'UI state file contains invalid data, returning default state');
        return createDefaultUiState();
      }
      
      logger.error({ error, filePath: this.filePath }, 'Failed to read UI state');
      throw error;
    }
  }

  /**
   * Updates a partial UI state.
   * Merges the partial state with the current state and saves atomically.
   */
  async update(partialState: Partial<UiState>): Promise<UiState> {
    try {
      // Get current state
      const currentState = await this.get();
      
      // Merge with partial state
      const updatedState: UiState = {
        ...currentState,
        ...partialState,
        // Ensure version fields are preserved
        version: currentState.version,
        currentVersion: currentState.currentVersion,
        migrations: currentState.migrations,
      };

      // Validate the merged state
      const validatedState = uiStateSchema.parse(updatedState);

      // Write atomically
      await this.store.write(validatedState);
      
      logger.info({ 
        filePath: this.filePath, 
        updatedFields: Object.keys(partialState) 
      }, 'Updated UI state');
      
      return validatedState;
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn({ error, partialState, filePath: this.filePath }, 'Invalid UI state update data');
        throw Object.assign(new Error('Invalid UI state update data'), { status: 400 });
      }
      
      logger.error({ error, partialState, filePath: this.filePath }, 'Failed to update UI state');
      throw error;
    }
  }

  /**
   * Resets the UI state to its default.
   * Saves the default state atomically.
   */
  async reset(): Promise<UiState> {
    try {
      const defaultState = createDefaultUiState();
      await this.store.write(defaultState);
      
      logger.info({ filePath: this.filePath }, 'Reset UI state to default');
      
      return defaultState;
    } catch (error) {
      logger.error({ error, filePath: this.filePath }, 'Failed to reset UI state');
      throw error;
    }
  }

  /**
   * Get file statistics for the UI state file.
   * Useful for debugging and monitoring.
   */
  async getStats(): Promise<{ exists: boolean; size?: number; mtime?: Date }> {
    try {
      const stats = await this.store.getStats();
      return {
        exists: stats !== null,
        ...(stats?.size !== undefined && { size: stats.size }),
        ...(stats?.mtime !== undefined && { mtime: stats.mtime }),
      };
    } catch (error) {
      logger.error({ error, filePath: this.filePath }, 'Failed to get UI state file stats');
      throw error;
    }
  }

  /**
   * Delete the UI state file and all its backups.
   * Use with caution - this will remove all persisted UI state.
   */
  async delete(): Promise<void> {
    try {
      await this.store.delete();
      logger.info({ filePath: this.filePath }, 'Deleted UI state file and backups');
    } catch (error) {
      logger.error({ error, filePath: this.filePath }, 'Failed to delete UI state file');
      throw error;
    }
  }
}
