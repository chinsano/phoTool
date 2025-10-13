import request from 'supertest';
import { describe, it } from 'vitest';

import { createApp } from '../src/app.js';
import { db } from '../src/db/client.js';
import { files } from '../src/db/schema/index.js';

describe('File Tag application routes', () => {
  const app = createApp();

  it('adds/removes tags for a single file and batch', async () => {
    // Seed one file row directly
    const uniquePath = `C:/media/a-${Date.now()}.jpg`;
    const [file] = await db.insert(files).values({
      path: uniquePath,
      dir: 'C:/media',
      name: uniquePath.split('/').pop()!,
      ext: 'jpg',
      size: 1,
      mtime: Date.now(),
      ctime: Date.now(),
    }).returning();
    const fileId = file!.id as number;

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const t1 = await request(app).post('/api/tags').send({ name: `T1-${suffix}` }).expect(201);
    const t2 = await request(app).post('/api/tags').send({ name: `T2-${suffix}` }).expect(201);

    await request(app)
      .post(`/api/files/${fileId}/tags`)
      .send({ mode: 'add', tagIds: [t1.body.id] })
      .expect(204);

    await request(app)
      .post('/api/files/tags')
      .send({ fileIds: [fileId], mode: 'add', tagIds: [t2.body.id] })
      .expect(204);

    await request(app)
      .post(`/api/files/${fileId}/tags`)
      .send({ mode: 'remove', tagIds: [t1.body.id] })
      .expect(204);
  });
});


