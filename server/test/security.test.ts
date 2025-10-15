import request from 'supertest';
import { describe, it, expect } from 'vitest';

import { createApp } from '../src/app.js';

describe('Security Headers', () => {
  it('sets Content-Security-Policy header', async () => {
    const app = createApp();
    const res = await request(app).get('/api/health');
    
    expect(res.headers).toHaveProperty('content-security-policy');
    const csp = res.headers['content-security-policy'];
    
    // Verify key CSP directives
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("img-src 'self' data: blob:");
  });

  it('sets X-Frame-Options header', async () => {
    const app = createApp();
    const res = await request(app).get('/api/health');
    
    expect(res.headers).toHaveProperty('x-frame-options');
    // Helmet sets this to SAMEORIGIN by default
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('sets X-Content-Type-Options header', async () => {
    const app = createApp();
    const res = await request(app).get('/api/health');
    
    expect(res.headers).toHaveProperty('x-content-type-options');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets X-DNS-Prefetch-Control header', async () => {
    const app = createApp();
    const res = await request(app).get('/api/health');
    
    expect(res.headers).toHaveProperty('x-dns-prefetch-control');
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
  });

  it('sets Strict-Transport-Security header', async () => {
    const app = createApp();
    const res = await request(app).get('/api/health');
    
    expect(res.headers).toHaveProperty('strict-transport-security');
    // Helmet sets HSTS with max-age
    expect(res.headers['strict-transport-security']).toContain('max-age=');
  });

  it('sets X-Download-Options header', async () => {
    const app = createApp();
    const res = await request(app).get('/api/health');
    
    expect(res.headers).toHaveProperty('x-download-options');
    expect(res.headers['x-download-options']).toBe('noopen');
  });

  it('sets security headers on all API routes', async () => {
    const app = createApp();
    const routes = ['/api/health', '/api/tags', '/api/albums'];
    
    for (const route of routes) {
      const res = await request(app).get(route);
      expect(res.headers).toHaveProperty('content-security-policy');
      expect(res.headers).toHaveProperty('x-frame-options');
      expect(res.headers).toHaveProperty('x-content-type-options');
    }
  });

  it('allows data: and blob: URLs for images (thumbnails)', async () => {
    const app = createApp();
    const res = await request(app).get('/api/health');
    
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("img-src 'self' data: blob:");
  });
});
