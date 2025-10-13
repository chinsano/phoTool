import request from 'supertest';
import { describe, it, expect } from 'vitest';

import { createApp } from '../src/app.js';
describe('GET / (root)', () => {
    it('responds with friendly message when web/dist missing', async () => {
        const app = createApp();
        const res = await request(app).get('/');
        expect(res.status).toBe(200);
        expect(res.text).toContain('phoTool server is running');
    });
});
