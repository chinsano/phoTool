import { defaultConfig, type ThumbnailInfo, type ThumbnailRequest } from '@phoTool/shared';
import { eq } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';

import { db } from '../db/client.js';
import { files } from '../db/schema/files.js';
import { AppError, NotFoundError } from '../errors.js';

type SharpImage = {
  metadata: () => Promise<{ width?: number; height?: number }>;
  jpeg: (opts: { quality: number }) => SharpImage;
  webp: (opts: { quality: number }) => SharpImage;
  png: () => SharpImage;
  resize: (opts: { width: number; height: number; fit: 'inside'; withoutEnlargement: boolean }) => SharpImage;
  toFile: (outPath: string) => Promise<void>;
};

type SharpLike = ((input: string) => SharpImage) & {
  metadata?: () => Promise<{ width?: number; height?: number }>;
};

async function loadSharp(): Promise<SharpLike> {
  try {
    const mod = await import('sharp');
    const lib = (mod as unknown as { default?: unknown }).default ?? mod;
    return lib as SharpLike;
  } catch {
    throw new AppError('Thumbnails not supported on this platform (sharp unavailable)', 501, 'thumbnails_unsupported');
  }
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export class ThumbnailsService {
  private readonly cacheDir = defaultConfig.thumbnails.cacheDir;

  async getOrCreateThumbnail(fileId: number, req: ThumbnailRequest): Promise<ThumbnailInfo> {
    const [row] = await db.select().from(files).where(eq(files.id, fileId));
    if (!row) {
      throw new NotFoundError(`File with id ${fileId} not found`);
    }
    const sharp = await loadSharp();
    const size = req.size ?? defaultConfig.thumbnails.defaultSize;
    const format = req.format ?? defaultConfig.thumbnails.format;
    const key = `${fileId}_${row.mtime ?? 0}_${size}_${format}`;
    const outDir = this.cacheDir;
    ensureDir(outDir);
    const outPath = path.join(outDir, `${key}.${format}`);

    if (fs.existsSync(outPath)) {
      const meta = await sharp(outPath).metadata();
      return {
        width: meta.width ?? size,
        height: meta.height ?? size,
        mtime: Number(row.mtime ?? 0),
        format,
        path: outPath,
      };
    }

    const pipeline = sharp(row.path).resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true });
    if (format === 'jpeg') {
      pipeline.jpeg({ quality: defaultConfig.thumbnails.quality });
    } else if (format === 'webp') {
      pipeline.webp({ quality: defaultConfig.thumbnails.quality });
    } else {
      pipeline.png();
    }
    await pipeline.toFile(outPath);
    const meta = await sharp(outPath).metadata();
    return {
      width: meta.width ?? size,
      height: meta.height ?? size,
      mtime: Number(row.mtime ?? 0),
      format,
      path: outPath,
    };
  }
}
