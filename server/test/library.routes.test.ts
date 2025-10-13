import request from 'supertest';
import { describe, it } from 'vitest';

import { createApp } from '../src/app.js';

describe('Library routes - delete semantics', () => {
  const app = createApp();

  it('unlinks tags from a group', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const g = await request(app).post('/api/tag-groups').send({ name: `G-${suffix}` }).expect(201);
    const t = await request(app).post('/api/tags').send({ name: `T-${suffix}` }).expect(201);
    await request(app).post(`/api/tag-groups/${g.body.id}/items`).send({ add: [t.body.id] }).expect(204);

    await request(app)
      .post('/api/library/delete')
      .send({ mode: 'group-unlink', groupId: g.body.id, tagIds: [t.body.id] })
      .expect(204);
  });
});


