import type { TagsAggregateRequest, TagsAggregateResponse } from '../contracts/aggregations.js';

export interface AggregationsPort {
  countTags(request: TagsAggregateRequest): Promise<TagsAggregateResponse>;
}
