import request from 'supertest';
import { describe, it, expect } from 'vitest';

import { createApp } from '../src/app.js';

describe('Tag Groups routes', () => {
  const app = createApp();

  it('creates a group and adds/removes items', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const g = await request(app).post('/api/tag-groups').send({ name: `Favorites-${suffix}` }).expect(201);
    expect(typeof g.body.id).toBe('number');

    const t = await request(app).post('/api/tags').send({ name: `Family-${suffix}` }).expect(201);

    await request(app)
      .post(`/api/tag-groups/${g.body.id}/items`)
      .send({ add: [t.body.id] })
      .expect(204);

    await request(app)
      .post(`/api/tag-groups/${g.body.id}/items`)
      .send({ remove: [t.body.id] })
      .expect(204);
  });
});


