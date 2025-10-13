export type Brand<K, T> = K & { __brand: T };

export type UIElementId = string & Brand<string, 'UIElementId'>;

export interface SampleType {
  id: string;
  createdAt: string;
}


export * from './contracts/health.js';
export * from './db/file.js';
export * from './db/tag.js';
export * from './db/fileTag.js';
