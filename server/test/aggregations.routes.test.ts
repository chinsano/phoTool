import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';

describe('aggregations routes', () => {
  it('validates body and returns 400 on invalid', async () => {
    const app = createApp();
    const res = await request(app).post('/api/tags/aggregate').send({});
    expect(res.status).toBe(400);
  });

  it('returns counts on valid selection request (empty selection = empty counts)', async () => {
    const app = createApp();
    const res = await request(app).post('/api/tags/aggregate').send({
      scope: 'selection',
      filter: { start: { id: 'root', mode: 'any', tagIds: [] }, links: [] },
    });
    expect(res.status).toBe(200);
    expect(res.body.counts).toBeDefined();
    expect(Array.isArray(res.body.counts)).toBe(true);
  });
});
