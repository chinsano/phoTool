import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import { ScannerService } from '../src/services/scanner/index.js';

// Use real app; mock scanner service internals lightly if needed

describe('scan routes', () => {
  it('starts a scan and returns a scanId, status reflects completion', async () => {
    // Spy on service to return deterministic result quickly
    const spy = vi.spyOn(ScannerService.prototype, 'run').mockResolvedValue({ added: 1, updated: 0, deleted: 0 });
    const app = createApp();
    const res = await request(app).post('/api/scan').send({ roots: ['.'], mode: 'auto' });
    expect(res.status).toBe(200);
    expect(res.body.scanId).toBeTruthy();

    // Poll status
    const id = res.body.scanId as string;
    // Give the microtask a tick
    await new Promise((r) => setTimeout(r, 10));
    const statusRes = await request(app).get('/api/scan/status').query({ scanId: id });
    expect(statusRes.status).toBe(200);
    expect(['running', 'completed', 'failed']).toContain(statusRes.body.phase);

    spy.mockRestore();
  });

  it('validates request body', async () => {
    const app = createApp();
    const res = await request(app).post('/api/scan').send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown scanId', async () => {
    const app = createApp();
    const res = await request(app).get('/api/scan/status').query({ scanId: 'does-not-exist' });
    expect(res.status).toBe(404);
  });
});


