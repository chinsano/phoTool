import { z } from 'zod';

// Smart Album schema (file-backed JSON)
export const smartAlbumSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(255),
  sources: z.array(z.string().min(1)).min(1), // At least one source directory
  filter: z.any(), // FilterChain - will be properly typed when available
});

export type SmartAlbum = z.infer<typeof smartAlbumSchema>;

// Album ID type (filename without .json extension) - supports UUIDs and alphanumeric
export const albumIdSchema = z.string().min(1).max(255).regex(/^[a-zA-Z0-9_-]+$/);
export type AlbumId = z.infer<typeof albumIdSchema>;

// Request/Response schemas for CRUD operations
export const createAlbumRequestSchema = z.object({
  name: z.string().min(1).max(255),
  sources: z.array(z.string().min(1)).min(1),
  filter: z.any(), // FilterChain
});

export const updateAlbumRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  sources: z.array(z.string().min(1)).min(1).optional(),
  filter: z.any().optional(), // FilterChain
});

export const albumDetailResponseSchema = smartAlbumSchema.extend({
  id: albumIdSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const albumListItemSchema = z.object({
  id: albumIdSchema,
  name: z.string().min(1).max(255),
  sources: z.array(z.string().min(1)).min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const albumListResponseSchema = z.object({
  albums: z.array(albumListItemSchema),
});

// Derived types
export type CreateAlbumRequest = z.infer<typeof createAlbumRequestSchema>;
export type UpdateAlbumRequest = z.infer<typeof updateAlbumRequestSchema>;
export type AlbumDetailResponse = z.infer<typeof albumDetailResponseSchema>;
export type AlbumListItem = z.infer<typeof albumListItemSchema>;
export type AlbumListResponse = z.infer<typeof albumListResponseSchema>;

// Album file path helper
export const getAlbumFilePath = (id: AlbumId): string => `data/albums/${id}.json`;

// Album ID from filename helper
export const getAlbumIdFromFilename = (filename: string): AlbumId | null => {
  if (!filename.endsWith('.json')) return null;
  const id = filename.slice(0, -5); // Remove .json extension
  const result = albumIdSchema.safeParse(id);
  return result.success ? result.data : null;
};

// Default album factory
export const createDefaultAlbum = (name: string, sources: string[]): SmartAlbum => ({
  version: 1,
  name,
  sources,
  filter: null, // Will be properly typed when FilterChain is available
});
