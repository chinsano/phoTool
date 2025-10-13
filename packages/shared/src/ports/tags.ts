import type { TagCreate, TagListResponse, TagUpdate } from '../contracts/tags.js';

export interface TagsPort {
  list(): Promise<TagListResponse>;
  create(input: TagCreate): Promise<{ id: number }>;
  update(id: number, input: TagUpdate): Promise<void>;
}


