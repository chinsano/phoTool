import type { ThumbnailInfo, ThumbnailRequest } from '../contracts/thumbnails.js';

export interface ThumbnailsPort {
  getOrCreateThumbnail(fileId: number, request: ThumbnailRequest): Promise<ThumbnailInfo>;
}
