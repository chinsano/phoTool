import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ExifToolService } from '../src/services/exiftool/index.js';

vi.mock('exiftool-vendored', () => {
  class MockExifTool {
    async version() { return '12.0'; }
    async end() { /* noop */ }
    async read() {
      return {
        Subject: ['A', 'B'],
        HierarchicalSubject: ['People|Family|Alice'],
        DateTimeOriginal: '2020:01:02 03:04:05',
        ImageWidth: 100,
        ImageHeight: 200,
        Duration: 1.5,
        GPSLatitude: 1.23,
        GPSLongitude: 4.56,
      } as unknown as Record<string, unknown>;
    }
    async write() { /* noop */ }
  }
  return { ExifTool: MockExifTool };
});

describe('ExifToolService', () => {
  let svc: ExifToolService;
  beforeEach(() => {
    svc = new ExifToolService();
  });
  afterEach(async () => {
    await svc.stop();
  });

  it('starts and reads metadata', async () => {
    await svc.start();
    const result = await svc.readMetadata('C:/tmp/file.jpg');
    expect(result.subjects).toEqual(['A', 'B']);
    expect(result.hierarchicalSubjects).toEqual([['People', 'Family', 'Alice']]);
    expect(result.dimensions.width).toBe(100);
  });

  it('writes subjects and hierarchical subjects', async () => {
    await svc.start();
    await svc.writeSubjects('C:/tmp/file.jpg', ['X']);
    await svc.writeHierarchicalSubjects('C:/tmp/file.jpg', [['A', 'B']]);
  });
});


