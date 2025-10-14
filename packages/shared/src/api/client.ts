import { z } from 'zod';

// API Error schema
export const apiErrorSchema = z.object({
  status: z.number().int().min(100).max(599),
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

// API Response wrapper
export type ApiResponse<T> = 
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

// HTTP Methods
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

// Request options
export interface ApiRequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string | number | boolean>;
}

// Generic API client interface
export interface ApiClient {
  // Generic request method
  request<T>(path: string, options?: ApiRequestOptions): Promise<ApiResponse<T>>;

  // Convenience methods
  get<T>(path: string, query?: Record<string, string | number | boolean>): Promise<ApiResponse<T>>;
  post<T>(path: string, body?: unknown): Promise<ApiResponse<T>>;
  put<T>(path: string, body?: unknown): Promise<ApiResponse<T>>;
  delete<T>(path: string): Promise<ApiResponse<T>>;
}

// API client configuration
export interface ApiClientConfig {
  baseUrl: string;
  timeout?: number;
  defaultHeaders?: Record<string, string>;
}

// Error handling utilities
export const isApiError = (error: unknown): error is ApiError => {
  return apiErrorSchema.safeParse(error).success;
};

export const createApiError = (
  status: number,
  code: string,
  message: string,
  details?: unknown
): ApiError => ({
  status,
  code,
  message,
  details,
});

// Common error codes
export const API_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
} as const;

export type ApiErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES];
