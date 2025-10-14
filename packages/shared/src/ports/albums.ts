import type { 
  AlbumId, 
  CreateAlbumRequest, 
  UpdateAlbumRequest,
  AlbumDetailResponse,
  AlbumListResponse 
} from '../contracts/albums.js';

export interface AlbumsPort {
  /**
   * List all albums
   */
  list(): Promise<AlbumListResponse>;

  /**
   * Get a single album by ID
   * @param id - Album ID
   */
  get(id: AlbumId): Promise<AlbumDetailResponse>;

  /**
   * Create a new album
   * @param request - Album creation data
   * @returns The created album with generated ID
   */
  create(request: CreateAlbumRequest): Promise<AlbumDetailResponse>;

  /**
   * Update an existing album
   * @param id - Album ID
   * @param request - Partial album update data
   * @returns The updated album
   */
  update(id: AlbumId, request: UpdateAlbumRequest): Promise<AlbumDetailResponse>;

  /**
   * Delete an album
   * @param id - Album ID
   */
  delete(id: AlbumId): Promise<void>;
}
