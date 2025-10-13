import type { TagApplyBatch, TagApplySingle } from '../contracts/tagApplication.js';

export interface TagApplicationPort {
  applyToFile(input: TagApplySingle): Promise<void>;
  applyToFiles(input: TagApplyBatch): Promise<void>;
}


