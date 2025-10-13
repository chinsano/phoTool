import type { FilesSearchRequest, FilesSearchResponse } from '../contracts/search.js';

export interface QueryPort {
  searchFiles(request: FilesSearchRequest): Promise<FilesSearchResponse>;
}
