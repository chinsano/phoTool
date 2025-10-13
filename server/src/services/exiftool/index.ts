import type { ExifToolPort, ReadMetadataResult } from '@phoTool/shared';
import { ExifTool } from 'exiftool-vendored';
import fs from 'node:fs';
import path from 'node:path';

import { fromHierarchicalSubjectStrings, normalizeSubjects, toHierarchicalSubjectStrings } from './mapping.js';
import { parseExifDateTimeOriginal } from './parse.js';
import { logger } from '../../logger.js';

// Basic scaffold; guards and mapping filled in subsequent tasks
export class ExifToolService implements ExifToolPort {
  private readonly exiftool: ExifTool;
  private running = 0;
  private readonly queue: Array<{
    run: () => Promise<unknown>;
    resolve: (v: unknown) => void;
    reject: (e: unknown) => void;
  }> = [];

  constructor() {
    this.exiftool = new ExifTool({ taskTimeoutMillis: ExifToolService.defaults.taskTimeoutMs });
  }

  async start(): Promise<void> {
    // exiftool-vendored starts lazily; keep for symmetry
    await this.exiftool.version().catch((err) => {
      logger.error({ err }, 'ExifTool start failed');
      throw err;
    });
  }

  async stop(): Promise<void> {
    await this.exiftool.end().catch((err) => {
      logger.warn({ err }, 'ExifTool stop encountered error');
    });
  }

  async readMetadata(filePath: string): Promise<ReadMetadataResult> {
    const safePath = ExifToolService.normalizeAndValidatePath(filePath);
    const sidecar = ExifToolService.sidecarPathFor(safePath);
    const readPath = fs.existsSync(sidecar) ? sidecar : safePath;
    const tags: Record<string, unknown> = await this.schedule(() => this.exiftool.read(readPath) as Promise<Record<string, unknown>>);
    const subjects = normalizeSubjects(tags.Subject as string[] | undefined);
    const hierarchical = fromHierarchicalSubjectStrings(tags.HierarchicalSubject as string[] | undefined);
    const takenAt = parseExifDateTimeOriginal(tags.DateTimeOriginal);
    const width = (tags.ImageWidth as number | undefined) ?? null;
    const height = (tags.ImageHeight as number | undefined) ?? null;
    const durationSec = (tags.Duration as number | undefined) ?? null;
    const lat = (tags.GPSLatitude as number | undefined) ?? null;
    const lon = (tags.GPSLongitude as number | undefined) ?? null;
    return {
      takenAt,
      gps: { lat, lon },
      dimensions: { width, height, durationSec },
      subjects,
      hierarchicalSubjects: hierarchical,
    };
  }

  async writeSubjects(filePath: string, subjects: string[]): Promise<void> {
    const safePath = ExifToolService.normalizeAndValidatePath(filePath);
    const sidecar = ExifToolService.sidecarPathFor(safePath);
    const allowed = subjects.map(String);
    const args = ExifToolService.ensureAllowedArgs(['-overwrite_original']);
    await this.schedule(() => this.exiftool.write(sidecar, { 'XMP-dc:Subject': allowed }, args));
  }

  async writeHierarchicalSubjects(filePath: string, paths: string[][]): Promise<void> {
    const safePath = ExifToolService.normalizeAndValidatePath(filePath);
    const sidecar = ExifToolService.sidecarPathFor(safePath);
    const flat = toHierarchicalSubjectStrings(paths);
    const args = ExifToolService.ensureAllowedArgs(['-overwrite_original']);
    await this.schedule(() => this.exiftool.write(sidecar, { 'XMP-lr:HierarchicalSubject': flat }, args));
  }

  async writeEmbeddedSubjects(filePath: string, subjects: string[]): Promise<void> {
    const safePath = ExifToolService.normalizeAndValidatePath(filePath);
    const allowed = subjects.map(String);
    const args = ExifToolService.ensureAllowedArgs(['-overwrite_original']);
    await this.schedule(() => this.exiftool.write(safePath, { 'XMP-dc:Subject': allowed }, args));
  }

  async writeEmbeddedHierarchicalSubjects(filePath: string, paths: string[][]): Promise<void> {
    const safePath = ExifToolService.normalizeAndValidatePath(filePath);
    const flat = toHierarchicalSubjectStrings(paths);
    const args = ExifToolService.ensureAllowedArgs(['-overwrite_original']);
    await this.schedule(() => this.exiftool.write(safePath, { 'XMP-lr:HierarchicalSubject': flat }, args));
  }

  static normalizeAndValidatePath(inputPath: string): string {
    const resolved = path.resolve(inputPath);
    if (!resolved) {
      throw new Error('Invalid file path');
    }
    return resolved;
  }

  static readonly defaults = {
    taskTimeoutMs: 20000,
    maxConcurrent: 2,
  } as const;

  private schedule<T>(op: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task = { run: op as () => Promise<unknown>, resolve: resolve as (v: unknown) => void, reject };
      this.queue.push(task);
      this.drain();
    });
  }

  private drain(): void {
    while (this.running < ExifToolService.defaults.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift()!;
      this.running += 1;
      task
        .run()
        .then((v) => task.resolve(v))
        .catch((e) => task.reject(e))
        .finally(() => {
          this.running -= 1;
          this.drain();
        });
    }
  }

  private static sidecarPathFor(filePath: string): string {
    const ext = path.extname(filePath);
    const base = filePath.slice(0, filePath.length - ext.length);
    return `${base}.xmp`;
  }

  private static ensureAllowedArgs(args: string[]): string[] {
    const allowed = new Set(['-overwrite_original']);
    for (const a of args) {
      if (!allowed.has(a)) {
        throw new Error(`Disallowed exiftool arg: ${a}`);
      }
    }
    return args;
  }
}


