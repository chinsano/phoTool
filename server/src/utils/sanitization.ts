import createDOMPurify from 'isomorphic-dompurify';
import { JSDOM } from 'jsdom';
import path from 'node:path';

import { ValidationError } from '../errors.js';

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Strips all script tags and event handlers.
 *
 * @param html - Raw HTML string
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'a',
      'code',
      'pre',
    ],
    ALLOWED_ATTR: ['href', 'title'],
  });
}

/**
 * Sanitize and validate a file system path.
 * Prevents path traversal attacks and ensures the path is absolute.
 *
 * @param userPath - User-provided path string
 * @param allowedBasePaths - Optional array of allowed base directories
 * @returns Normalized absolute path
 * @throws ValidationError if path contains traversal attempts or is outside allowed base paths
 */
export function sanitizePath(userPath: string, allowedBasePaths?: string[]): string {
  // Normalize path (resolves .. and . segments)
  const normalized = path.resolve(userPath);

  // Check for path traversal patterns before normalization
  // This catches attempts like "../../../etc/passwd"
  const suspiciousPatterns = [/\.\.[/\\]/g, /[/\\]\.\.[/\\]/g, /[/\\]\.\.$/];
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(userPath)) {
      throw new ValidationError('Path traversal detected', { path: userPath });
    }
  }

  // Check for null bytes (path injection)
  if (userPath.includes('\0')) {
    throw new ValidationError('Invalid path: null byte detected', { path: userPath });
  }

  // If allowed base paths are specified, ensure the normalized path is within one of them
  if (allowedBasePaths && allowedBasePaths.length > 0) {
    const normalizedBasePaths = allowedBasePaths.map((p) => path.resolve(p));
    const isWithinAllowedPath = normalizedBasePaths.some((basePath) =>
      normalized.startsWith(basePath)
    );

    if (!isWithinAllowedPath) {
      throw new ValidationError('Path is outside allowed directories', {
        path: userPath,
        allowedPaths: normalizedBasePaths,
      });
    }
  }

  return normalized;
}

/**
 * Sanitize an array of file system paths.
 * Convenience wrapper around sanitizePath for batch operations.
 *
 * @param paths - Array of user-provided paths
 * @param allowedBasePaths - Optional array of allowed base directories
 * @returns Array of normalized absolute paths
 * @throws ValidationError if any path is invalid
 */
export function sanitizePaths(paths: string[], allowedBasePaths?: string[]): string[] {
  return paths.map((p) => sanitizePath(p, allowedBasePaths));
}
