// API endpoint path constants
// These map to the routes defined in server/src/app.ts

export const API_ENDPOINTS = {
  // Health
  HEALTH: '/api/health',

  // Scanning
  SCAN: '/api/scan',
  SCAN_STATUS: '/api/scan/status',

  // Files
  FILES_SEARCH: '/api/files/search',
  FILES_THUMBNAIL: (id: number) => `/api/files/${id}/thumbnail`,

  // File Tags
  FILES_TAGS: '/api/files/tags',
  FILE_TAGS: (id: number) => `/api/files/${id}/tags`,

  // Tags
  TAGS: '/api/tags',
  TAG: (id: number) => `/api/tags/${id}`,

  // Tag Groups
  TAG_GROUPS: '/api/tag-groups',
  TAG_GROUP: (id: number) => `/api/tag-groups/${id}`,
  TAG_GROUP_ITEMS: (id: number) => `/api/tag-groups/${id}/items`,

  // Aggregations
  AGGREGATIONS: '/api/aggregations',
  TAGS_AGGREGATE: '/api/tags/aggregate', // Temporary alias

  // Library
  LIBRARY: '/api/library',

  // Sync
  SYNC: '/api/sync',

  // Placeholders
  EXPAND_PLACEHOLDER: '/api/expand-placeholder',

  // Albums (to be implemented)
  ALBUMS: '/api/albums',
  ALBUM: (id: string) => `/api/albums/${id}`,

  // UI State (to be implemented)
  UI_STATE: '/api/state',

  // I18n (to be implemented)
  I18N: (lang: string) => `/i18n/${lang}/ui.json`,

  // Tutorials (to be implemented)
  TUTORIALS: '/api/tutorials',
  TUTORIAL: (id: string) => `/api/tutorials/${id}`,
} as const;

// Type-safe endpoint builder
export type ApiEndpoint = typeof API_ENDPOINTS[keyof typeof API_ENDPOINTS];

// Helper to build query strings
export const buildQueryString = (params: Record<string, string | number | boolean>): string => {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  
  return searchParams.toString();
};

// Helper to build full URLs with query params
export const buildUrl = (
  baseUrl: string,
  endpoint: string,
  query?: Record<string, string | number | boolean>
): string => {
  const queryString = query ? buildQueryString(query) : '';
  return `${baseUrl}${endpoint}${queryString ? `?${queryString}` : ''}`;
};
