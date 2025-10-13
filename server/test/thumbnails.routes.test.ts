import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';

describe('thumbnails routes', () => {
  it('returns 400 for invalid id', async () => {
    const app = createApp();
    const res = await request(app).get('/api/files/abc/thumbnail');
    expect(res.status).toBe(400);
  });

  it('returns 404 or 501 when file missing or sharp unavailable', async () => {
    const app = createApp();
    const res = await request(app).get('/api/files/99999/thumbnail');
    expect([404, 501]).toContain(res.status);
  });
});
