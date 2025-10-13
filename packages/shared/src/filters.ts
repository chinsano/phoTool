import { z } from 'zod';

export const nodeModeSchema = z.enum(['all', 'any']);
export type NodeMode = z.infer<typeof nodeModeSchema>;

export const connectorSchema = z.enum(['and', 'or', 'and-not', 'none']);
export type Connector = z.infer<typeof connectorSchema>;

export const filterNodeSchema = z.object({
  id: z.string().min(1),
  mode: nodeModeSchema,
  tagIds: z.array(z.string().min(1)).default([]),
});
export type FilterNode = z.infer<typeof filterNodeSchema>;

const linkSchema = z.object({
  connector: z.union([z.literal('and'), z.literal('or'), z.literal('and-not')]),
  node: filterNodeSchema,
});

export const filterChainSchema = z.object({
  start: filterNodeSchema,
  links: z.array(linkSchema).default([]),
});
export type FilterChain = z.infer<typeof filterChainSchema>;
