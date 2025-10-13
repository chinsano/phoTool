import type { FilterChain, FilterNode } from '@PhoTool/shared';

export interface BuiltQuery {
  sql: string;
}

function buildNodeCte(node: FilterNode, idx: number): string {
  const tableAlias = `ft${idx}`;
  const numericTagIds = node.tagIds.map((id) => Number(id)).filter((n) => Number.isFinite(n));
  if (numericTagIds.length === 0) {
    // No tags in node → produce empty result set CTE
    return `node_${idx} AS (SELECT 0 AS file_id WHERE 1=0)`;
  }
  const inList = numericTagIds.join(', ');
  const base = `SELECT ${tableAlias}.file_id AS file_id FROM file_tags ${tableAlias} WHERE ${tableAlias}.tag_id IN (${inList})`;
  if (node.mode === 'all') {
    return `node_${idx} AS (
      ${base}
      GROUP BY ${tableAlias}.file_id
      HAVING COUNT(DISTINCT ${tableAlias}.tag_id) = ${numericTagIds.length}
    )`;
  }
  return `node_${idx} AS (
    ${base}
    GROUP BY ${tableAlias}.file_id
  )`;
}

export function buildFilterChainQuery(chain: FilterChain): BuiltQuery {
  const ctes: string[] = [];
  ctes.push(buildNodeCte(chain.start, 0));
  chain.links.forEach((link, i) => {
    const idx = i + 1;
    ctes.push(buildNodeCte(link.node, idx));
  });

  let combined = 'SELECT file_id FROM node_0';
  chain.links.forEach((link, i) => {
    const idx = i + 1;
    const setOp = link.connector === 'and' ? 'INTERSECT' : link.connector === 'or' ? 'UNION' : 'EXCEPT';
    combined = `(${combined}) ${setOp} SELECT file_id FROM node_${idx}`;
  });

  const sql = `WITH ${ctes.join(',\n')}\n${combined}`;
  return { sql };
}
