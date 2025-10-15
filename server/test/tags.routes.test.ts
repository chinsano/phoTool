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

  describe('Error handling', () => {
    it('returns 404 when updating non-existent tag', async () => {
      const res = await request(app)
        .put('/api/tags/999999')
        .send({ name: 'NonExistent', color: '#000000' })
        .expect(404);
      
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toHaveProperty('code', 'not_found');
      expect(res.body.error).toHaveProperty('message');
      expect(res.body.error.message).toContain('999999');
    });

    it('returns 409 when creating duplicate tag', async () => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const tagName = `Duplicate-${suffix}`;
      
      // Create first tag
      await request(app)
        .post('/api/tags')
        .send({ name: tagName, color: '#ff0000' })
        .expect(201);
      
      // Try to create duplicate
      const res = await request(app)
        .post('/api/tags')
        .send({ name: tagName, color: '#00ff00' })
        .expect(409);
      
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toHaveProperty('code', 'conflict');
      expect(res.body.error).toHaveProperty('message');
      expect(res.body.error.message).toContain(tagName);
    });

    it('returns 409 when updating tag to duplicate name', async () => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const name1 = `Tag1-${suffix}`;
      const name2 = `Tag2-${suffix}`;
      
      // Create two tags
      const tag1 = await request(app)
        .post('/api/tags')
        .send({ name: name1, color: '#ff0000' })
        .expect(201);
      
      await request(app)
        .post('/api/tags')
        .send({ name: name2, color: '#00ff00' })
        .expect(201);
      
      // Try to rename tag1 to tag2's name
      const res = await request(app)
        .put(`/api/tags/${tag1.body.id}`)
        .send({ name: name2 })
        .expect(409);
      
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toHaveProperty('code', 'conflict');
    });

    it('returns 400 for invalid tag id', async () => {
      const res = await request(app)
        .put('/api/tags/invalid')
        .send({ name: 'Test' })
        .expect(400);
      
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toHaveProperty('code', 'validation_error');
    });

    it('returns 400 for invalid request body', async () => {
      const res = await request(app)
        .post('/api/tags')
        .send({ invalidField: 'test' })
        .expect(400);
      
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toHaveProperty('code', 'validation_error');
    });
  });
});


