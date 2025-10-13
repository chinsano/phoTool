import type { TagGroupCreate, TagGroupItemsChange, TagGroupListResponse } from '../contracts/tagGroups.js';

export interface TagGroupsPort {
  list(): Promise<TagGroupListResponse>;
  create(input: TagGroupCreate): Promise<{ id: number }>;
  changeItems(groupId: number, change: TagGroupItemsChange): Promise<void>;
}


