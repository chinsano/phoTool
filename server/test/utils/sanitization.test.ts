import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../src/errors.js';
import { sanitizeHtml, sanitizePath, sanitizePaths } from '../../src/utils/sanitization.js';

describe('sanitization utilities', () => {
  describe('sanitizeHtml', () => {
    it('should allow safe HTML tags', () => {
      const input = '<p>Hello <strong>world</strong></p>';
      const result = sanitizeHtml(input);
      expect(result).toBe('<p>Hello <strong>world</strong></p>');
    });

    it('should strip script tags', () => {
      const input = '<p>Hello</p><script>alert("xss")</script>';
      const result = sanitizeHtml(input);
      expect(result).toBe('<p>Hello</p>');
    });

    it('should strip event handlers', () => {
      const input = '<p onclick="alert(\'xss\')">Click me</p>';
      const result = sanitizeHtml(input);
      expect(result).toBe('<p>Click me</p>');
    });

    it('should allow safe links', () => {
      const input = '<a href="https://example.com" title="Example">Link</a>';
      const result = sanitizeHtml(input);
      expect(result).toBe('<a href="https://example.com" title="Example">Link</a>');
    });

    it('should strip javascript: protocol in links', () => {
      const input = '<a href="javascript:alert(\'xss\')">Bad Link</a>';
      const result = sanitizeHtml(input);
      expect(result).toBe('<a>Bad Link</a>');
    });

    it('should allow code and pre tags', () => {
      const input = '<pre><code>const x = 1;</code></pre>';
      const result = sanitizeHtml(input);
      expect(result).toBe('<pre><code>const x = 1;</code></pre>');
    });

    it('should handle empty string', () => {
      const result = sanitizeHtml('');
      expect(result).toBe('');
    });
  });

  describe('sanitizePath', () => {
    it('should normalize a valid absolute path', () => {
      const input = '/home/user/photos';
      const result = sanitizePath(input);
      expect(result).toBe(path.resolve(input));
    });

    it('should normalize a valid relative path to absolute', () => {
      const input = 'photos/vacation';
      const result = sanitizePath(input);
      expect(path.isAbsolute(result)).toBe(true);
    });

    it('should reject path traversal with ../', () => {
      const input = '../../../etc/passwd';
      expect(() => sanitizePath(input)).toThrow(ValidationError);
      expect(() => sanitizePath(input)).toThrow('Path traversal detected');
    });

    it('should reject path traversal in middle of path', () => {
      const input = '/home/user/../../../etc/passwd';
      expect(() => sanitizePath(input)).toThrow(ValidationError);
    });

    it('should reject path traversal at end of path', () => {
      const input = '/home/user/..';
      expect(() => sanitizePath(input)).toThrow(ValidationError);
    });

    it('should reject null bytes', () => {
      const input = '/home/user\0/file.txt';
      expect(() => sanitizePath(input)).toThrow(ValidationError);
      expect(() => sanitizePath(input)).toThrow('null byte detected');
    });

    it('should accept path within allowed base path', () => {
      const input = '/home/user/photos/vacation.jpg';
      const allowedBasePaths = ['/home/user/photos', '/home/user/videos'];
      const result = sanitizePath(input, allowedBasePaths);
      expect(result).toBe(path.resolve(input));
    });

    it('should reject path outside allowed base paths', () => {
      const input = '/home/user/documents/secret.txt';
      const allowedBasePaths = ['/home/user/photos', '/home/user/videos'];
      expect(() => sanitizePath(input, allowedBasePaths)).toThrow(ValidationError);
      expect(() => sanitizePath(input, allowedBasePaths)).toThrow(
        'Path is outside allowed directories'
      );
    });

    it('should allow path that starts with allowed base path', () => {
      const input = '/home/user/photos/2024/vacation/img.jpg';
      const allowedBasePaths = ['/home/user/photos'];
      const result = sanitizePath(input, allowedBasePaths);
      expect(result).toBe(path.resolve(input));
    });

    it('should handle Windows-style path separators', () => {
      const input = 'photos\\..\\..\\..\\etc\\passwd';
      expect(() => sanitizePath(input)).toThrow(ValidationError);
    });

    it('should normalize paths with multiple slashes', () => {
      const input = '/home//user///photos';
      const result = sanitizePath(input);
      expect(result).toBe(path.resolve('/home/user/photos'));
    });
  });

  describe('sanitizePaths', () => {
    it('should sanitize multiple valid paths', () => {
      const inputs = ['/home/user/photos', '/home/user/videos'];
      const results = sanitizePaths(inputs);
      expect(results).toEqual([path.resolve(inputs[0]!), path.resolve(inputs[1]!)]);
    });

    it('should throw on first invalid path', () => {
      const inputs = ['/home/user/photos', '../../../etc/passwd'];
      expect(() => sanitizePaths(inputs)).toThrow(ValidationError);
    });

    it('should enforce allowed base paths for all paths', () => {
      const inputs = ['/home/user/photos/a.jpg', '/home/user/photos/b.jpg'];
      const allowedBasePaths = ['/home/user/photos'];
      const results = sanitizePaths(inputs, allowedBasePaths);
      expect(results).toHaveLength(2);
    });

    it('should reject if any path is outside allowed base paths', () => {
      const inputs = ['/home/user/photos/a.jpg', '/home/user/documents/b.txt'];
      const allowedBasePaths = ['/home/user/photos'];
      expect(() => sanitizePaths(inputs, allowedBasePaths)).toThrow(ValidationError);
    });

    it('should handle empty array', () => {
      const results = sanitizePaths([]);
      expect(results).toEqual([]);
    });
  });
});
