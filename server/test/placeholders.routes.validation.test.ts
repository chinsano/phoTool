import request from 'supertest';
import { describe, it, expect } from 'vitest';

import { createApp } from '../src/app.js';

describe('expand-placeholder route validation', () => {
  it('rejects invalid body', async () => {
    const app = createApp();
    const res = await request(app).post('/api/expand-placeholder').send({ tokens: ['year'] });
    expect(res.status).toBe(400);
  });

  it('rejects too many fileIds', async () => {
    const app = createApp();
    const many = Array.from({ length: 1001 }, (_, i) => i + 1);
    const res = await request(app).post('/api/expand-placeholder').send({ fileIds: many, tokens: ['year'] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });
});


