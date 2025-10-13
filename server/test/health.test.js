import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { HealthResponse } from '@shared/contracts/health';
describe('GET /api/health', () => {
    it('returns ok true and schema-valid payload', async () => {
        const app = createApp();
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        const parsed = HealthResponse.safeParse(res.body);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data.ok).toBe(true);
        }
    });
});
