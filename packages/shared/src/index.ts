export type Brand<K, T> = K & { __brand: T };

export type UIElementId = string & Brand<string, 'UIElementId'>;

export interface SampleType {
  id: string;
  createdAt: string;
}


export * from './contracts/health.js';
export * from './db/file.js';
export * from './db/tag.js';
export * from './db/fileTag.js';
export * from './ports/exiftool.js';
export * from './ports/scanner.js';
export * from './filters.js';
export * from './contracts/search.js';
export * from './contracts/aggregations.js';
export * from './contracts/thumbnails.js';
export * from './contracts/tags.js';
export * from './contracts/tagGroups.js';
export * from './contracts/tagApplication.js';
export * from './contracts/library.js';
export * from './contracts/placeholders.js';
export * from './contracts/albums.js';
export * from './ports/query.js';
export * from './ports/aggregations.js';
export * from './ports/thumbnails.js';
export * from './ports/tags.js';
export * from './ports/tagGroups.js';
export * from './ports/tagApplication.js';
export * from './ports/placeholders.js';
export * from './ports/albums.js';
export * from './uiState.js';
export * from './ports/uiState.js';
export * from './api/client.js';
export * from './api/endpoints.js';
export * from './config.js';
