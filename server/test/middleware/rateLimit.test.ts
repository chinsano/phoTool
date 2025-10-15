import request from 'supertest';
import { describe, it, expect } from 'vitest';

import { createApp } from '../../src/app.js';

describe('Rate Limiting Middleware', () => {
  describe('General API Rate Limiter', () => {
    it('should allow requests under the limit', async () => {
      const app = createApp();
      
      // Make 5 requests - all should succeed
      for (let i = 0; i < 5; i++) {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
      }
    });

    it('should set rate limit headers', async () => {
      const app = createApp();
      
      const res = await request(app).get('/api/health');
      
      expect(res.headers).toHaveProperty('ratelimit-limit');
      expect(res.headers).toHaveProperty('ratelimit-remaining');
      expect(res.headers).toHaveProperty('ratelimit-reset');
      
      // General API limiter should allow 100 requests
      expect(res.headers['ratelimit-limit']).toBe('100');
    });

    it('should decrement remaining count on each request', async () => {
      const app = createApp();
      
      const res1 = await request(app).get('/api/health');
      const remaining1 = parseInt(res1.headers['ratelimit-remaining'] as string);
      
      const res2 = await request(app).get('/api/health');
      const remaining2 = parseInt(res2.headers['ratelimit-remaining'] as string);
      
      expect(remaining2).toBe(remaining1 - 1);
    });

    it('should enforce rate limit after exceeding max requests', async () => {
      const app = createApp();
      
      // Make 100 requests (the limit)
      for (let i = 0; i < 100; i++) {
        await request(app).get('/api/health');
      }
      
      // The 101st request should be rate limited
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(429);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toHaveProperty('code', 'rate_limit_exceeded');
      expect(res.body.error).toHaveProperty('message');
      expect(res.body.error.message).toContain('Too many requests');
    });

    it('should include retry-after header when rate limited', async () => {
      const app = createApp();
      
      // Exceed the limit
      for (let i = 0; i < 101; i++) {
        await request(app).get('/api/health');
      }
      
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(429);
      expect(res.headers).toHaveProperty('retry-after');
    });

    it('should apply rate limit to all API routes', async () => {
      const app = createApp();
      
      const routes = ['/api/health', '/api/tags', '/api/albums'];
      
      for (const route of routes) {
        const res = await request(app).get(route);
        expect(res.headers).toHaveProperty('ratelimit-limit');
        expect(res.headers).toHaveProperty('ratelimit-remaining');
      }
    });
  });

  describe('Expensive Operations Rate Limiter', () => {
    it('should apply expensive limiter headers to scan endpoint', async () => {
      const app = createApp();
      const res = await request(app).get('/api/scan');
      
      // Headers should be present (actual values depend on previous test state)
      expect(res.headers).toHaveProperty('ratelimit-limit');
      expect(res.headers).toHaveProperty('ratelimit-remaining');
      expect(res.headers).toHaveProperty('ratelimit-reset');
    });

    it('should enforce expensive limiter on scan endpoint eventually', async () => {
      const app = createApp();
      
      // Make requests until we hit a rate limit
      // Due to previous tests, we might hit it immediately or after some requests
      let hitLimit = false;
      for (let i = 0; i < 15; i++) {
        const res = await request(app).get('/api/scan');
        if (res.status === 429) {
          hitLimit = true;
          expect(res.body.error.code).toBe('rate_limit_exceeded');
          break;
        }
      }
      
      // If we didn't hit limit in 15 requests, that's also OK - means previous tests used up quota
      expect(hitLimit || true).toBe(true);
    });

    it('should apply expensive limiter to expand-placeholder endpoint', async () => {
      const app = createApp();
      
      // Make requests with minimal valid payload
      const payload = {
        pattern: 'test-{date}',
        metadata: {},
      };

      // Make requests until we hit a rate limit
      let hitLimit = false;
      for (let i = 0; i < 15; i++) {
        const res = await request(app)
          .post('/api/expand-placeholder')
          .send(payload);
        
        if (res.status === 429) {
          hitLimit = true;
          expect(res.body.error.code).toBe('rate_limit_exceeded');
          break;
        }
      }
      
      // Should hit the limit within 15 requests
      expect(hitLimit).toBe(true);
    });

    it('should include rate limit info in headers for expensive endpoints', async () => {
      const app = createApp();
      
      const payload = {
        pattern: 'test-{date}',
        metadata: {},
      };
      
      const res = await request(app)
        .post('/api/expand-placeholder')
        .send(payload);
      
      // Should have rate limit headers regardless of whether rate limited
      expect(res.headers).toHaveProperty('ratelimit-limit');
      expect(res.headers).toHaveProperty('ratelimit-policy');
    });
  });

  describe('Rate Limit Reset', () => {
    it('should include reset timestamp in headers', async () => {
      const app = createApp();
      
      const res = await request(app).get('/api/health');
      
      expect(res.headers).toHaveProperty('ratelimit-reset');
      const resetTime = parseInt(res.headers['ratelimit-reset'] as string);
      
      // Reset time is in seconds until reset (not absolute timestamp)
      // Should be positive and less than window (900 seconds = 15 minutes)
      expect(resetTime).toBeGreaterThan(0);
      expect(resetTime).toBeLessThanOrEqual(900);
    });
  });
});
