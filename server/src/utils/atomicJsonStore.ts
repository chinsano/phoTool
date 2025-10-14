import fs from 'node:fs/promises';
import path from 'node:path';

import { logger } from '../logger.js';

/**
 * Utility for atomic JSON file operations with rotating backups.
 * Ensures data integrity by writing to temporary files first, then atomically moving them.
 * Maintains rotating backups (.bak.1, .bak.2) for recovery.
 */
export class AtomicJsonStore<T> {
  private readonly filePath: string;
  private readonly backupCount: number;

  constructor(filePath: string, backupCount: number = 2) {
    this.filePath = filePath;
    this.backupCount = backupCount;
  }

  /**
   * Read and parse JSON from the file.
   * Returns null if file doesn't exist.
   */
  async read(): Promise<T | null> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      logger.error({ error, filePath: this.filePath }, 'Failed to read JSON file');
      throw error;
    }
  }

  /**
   * Write data to the file atomically with rotating backups.
   * Creates backups before writing the new content.
   */
  async write(data: T): Promise<void> {
    const dir = path.dirname(this.filePath);
    const tempPath = `${this.filePath}.tmp.${Date.now()}`;

    try {
      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });

      // Write to temporary file first
      const content = JSON.stringify(data, null, 2);
      await fs.writeFile(tempPath, content, 'utf-8');

      // Create backups if file exists
      if (await this.fileExists()) {
        await this.rotateBackups();
      }

      // Atomically move temp file to final location
      await fs.rename(tempPath, this.filePath);

      logger.debug({ filePath: this.filePath }, 'Successfully wrote JSON file atomically');
    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      logger.error({ error, filePath: this.filePath }, 'Failed to write JSON file atomically');
      throw error;
    }
  }

  /**
   * Delete the file and all its backups.
   */
  async delete(): Promise<void> {
    try {
      // Delete main file
      await fs.unlink(this.filePath);
      
      // Delete backups
      for (let i = 1; i <= this.backupCount; i++) {
        const backupPath = `${this.filePath}.bak.${i}`;
        try {
          await fs.unlink(backupPath);
        } catch {
          // Ignore if backup doesn't exist
        }
      }

      logger.debug({ filePath: this.filePath }, 'Successfully deleted JSON file and backups');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist, that's fine
        return;
      }
      logger.error({ error, filePath: this.filePath }, 'Failed to delete JSON file');
      throw error;
    }
  }

  /**
   * Check if the file exists.
   */
  async exists(): Promise<boolean> {
    return this.fileExists();
  }

  /**
   * Get file stats if it exists.
   */
  async getStats(): Promise<{ mtime: Date; size: number } | null> {
    try {
      const stats = await fs.stat(this.filePath);
      return {
        mtime: stats.mtime,
        size: stats.size,
      };
    } catch {
      return null;
    }
  }

  private async fileExists(): Promise<boolean> {
    try {
      await fs.access(this.filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async rotateBackups(): Promise<void> {
    // Delete oldest backup
    const oldestBackup = `${this.filePath}.bak.${this.backupCount}`;
    try {
      await fs.unlink(oldestBackup);
    } catch {
      // Ignore if doesn't exist
    }

    // Shift backups: .bak.1 -> .bak.2, .bak.2 -> .bak.3, etc.
    for (let i = this.backupCount - 1; i >= 1; i--) {
      const currentBackup = `${this.filePath}.bak.${i}`;
      const nextBackup = `${this.filePath}.bak.${i + 1}`;
      
      try {
        await fs.rename(currentBackup, nextBackup);
      } catch {
        // Ignore if current backup doesn't exist
      }
    }

    // Move current file to .bak.1
    try {
      await fs.rename(this.filePath, `${this.filePath}.bak.1`);
    } catch (error) {
      logger.error({ error, filePath: this.filePath }, 'Failed to create backup');
      throw error;
    }
  }
}
