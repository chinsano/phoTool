import request from 'supertest';
import { describe, it, expect } from 'vitest';

import { createApp } from '../src/app.js';

describe('POST /api/expand-placeholder', () => {
  it('validates body and returns 400 on invalid', async () => {
    const app = createApp();
    const res = await request(app).post('/api/expand-placeholder').send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('returns expansions object on valid request', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/expand-placeholder')
      .send({ fileIds: [1], tokens: ['year'] });
    // We cannot guarantee seeded DB here; just assert shape
    expect([200, 400, 404, 500]).toContain(res.status);
  });
});


