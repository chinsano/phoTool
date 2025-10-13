import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';

describe('files search routes', () => {
  it('validates body and returns 400 on invalid', async () => {
    const app = createApp();
    const res = await request(app).post('/api/files/search').send({});
    expect(res.status).toBe(400);
  });

  it('returns empty items on valid request when db empty', async () => {
    const app = createApp();
    const res = await request(app).post('/api/files/search').send({
      filter: { start: { id: 'root', mode: 'any', tagIds: [] }, links: [] },
    });
    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});
