import request from 'supertest';
import { describe, it, expect } from 'vitest';

import { createApp } from '../src/app.js';

describe('Tags routes', () => {
  const app = createApp();

  it('lists tags (initially empty set is ok)', async () => {
    const res = await request(app).get('/api/tags').expect(200);
    expect(res.body).toHaveProperty('tags');
    expect(Array.isArray(res.body.tags)).toBe(true);
  });

  it('creates and updates a tag', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const create = await request(app)
      .post('/api/tags')
      .send({ name: `Travel-${suffix}`, color: '#ff9900' })
      .expect(201);
    expect(typeof create.body.id).toBe('number');

    await request(app)
      .put(`/api/tags/${create.body.id}`)
      .send({ name: `Trips-${suffix}`, color: '#ffaa00' })
      .expect(204);
  });
});


