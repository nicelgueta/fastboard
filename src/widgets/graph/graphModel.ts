import type { CatalogGraph, CatalogNode } from './catalog';

/**
 * Pure graph helpers behind the 3D explorer: no React, no three.js, so the
 * depth cap / degree / search logic can be unit tested on its own.
 */

/** Above this many rendered nodes the widget asks before drawing - 3D force layout gets slow fast. */
export const NODE_WARN_THRESHOLD = 5000;

/**
 * BFS level of every node, measured from the roots (nodes nothing links *to*)
 * along link direction. database=0, schema=1, table=2, column=3 for a catalog.
 * A node in a cycle with no root above it is treated as level 0 so it is never lost.
 */
export function computeLevels(graph: CatalogGraph): Map<string, number> {
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const n of graph.nodes) {
    incoming.set(n.id, 0);
    outgoing.set(n.id, []);
  }
  for (const l of graph.links) {
    if (!incoming.has(l.source) || !incoming.has(l.target)) continue;
    incoming.set(l.target, (incoming.get(l.target) ?? 0) + 1);
    outgoing.get(l.source)!.push(l.target);
  }

  const levels = new Map<string, number>();
  const queue: string[] = [];
  for (const n of graph.nodes) {
    if (incoming.get(n.id) === 0) {
      levels.set(n.id, 0);
      queue.push(n.id);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    const next = (levels.get(id) ?? 0) + 1;
    for (const t of outgoing.get(id) ?? []) {
      if (!levels.has(t)) {
        levels.set(t, next);
        queue.push(t);
      }
    }
  }
  // unreachable from any root (pure cycles)
  for (const n of graph.nodes) if (!levels.has(n.id)) levels.set(n.id, 0);
  return levels;
}

/** Keep only nodes at BFS level <= maxLevel, and the links between survivors. */
export function limitDepth(graph: CatalogGraph, maxLevel: number): CatalogGraph {
  const levels = computeLevels(graph);
  const keep = new Set<string>();
  const nodes = graph.nodes.filter((n) => {
    const ok = (levels.get(n.id) ?? 0) <= maxLevel;
    if (ok) keep.add(n.id);
    return ok;
  });
  const links = graph.links.filter((l) => keep.has(l.source) && keep.has(l.target));
  return { nodes, links };
}

/** Number of links touching each node (in + out). Drives node size. */
export function computeDegrees(graph: CatalogGraph): Map<string, number> {
  const degrees = new Map<string, number>();
  for (const n of graph.nodes) degrees.set(n.id, 0);
  for (const l of graph.links) {
    if (degrees.has(l.source)) degrees.set(l.source, degrees.get(l.source)! + 1);
    if (degrees.has(l.target)) degrees.set(l.target, degrees.get(l.target)! + 1);
  }
  return degrees;
}

/** Ids of the nodes directly linked to `id`, in either direction. */
export function neighborIds(graph: CatalogGraph, id: string): Set<string> {
  const out = new Set<string>();
  for (const l of graph.links) {
    if (l.source === id) out.add(l.target);
    else if (l.target === id) out.add(l.source);
  }
  return out;
}

/** Case-insensitive label search. An empty query matches nothing (callers treat that as "no filter"). */
export function matchNodes(nodes: CatalogNode[], query: string): Set<string> {
  const q = query.trim().toLowerCase();
  const out = new Set<string>();
  if (!q) return out;
  for (const n of nodes) {
    if (n.label.toLowerCase().includes(q) || n.kind.toLowerCase() === q) out.add(n.id);
  }
  return out;
}

/** Union of two graphs by node id / link (source,target,relation). Used to fold in `CatalogSource.expand` results. */
export function mergeGraphs(base: CatalogGraph, extra: CatalogGraph): CatalogGraph {
  const nodeIds = new Set(base.nodes.map((n) => n.id));
  const linkKey = (l: { source: string; target: string; relation: string }) =>
    `${l.source}${l.target}${l.relation}`;
  const linkKeys = new Set(base.links.map(linkKey));
  return {
    nodes: [...base.nodes, ...extra.nodes.filter((n) => !nodeIds.has(n.id))],
    links: [...base.links, ...extra.links.filter((l) => !linkKeys.has(linkKey(l)))],
  };
}

export function countByKind(graph: CatalogGraph): Record<string, number> {
  const out: Record<string, number> = {};
  for (const n of graph.nodes) out[n.kind] = (out[n.kind] ?? 0) + 1;
  return out;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
/** Node labels come from user-supplied table/column names and end up in an HTML tooltip. */
export const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

/** Coarse families of column data types, used to colour-code column nodes. */
export type TypeGroup = 'text' | 'numeric' | 'boolean' | 'temporal' | 'nested' | 'other';

export const TYPE_GROUP_LABELS: Record<TypeGroup, string> = {
  text: 'text',
  numeric: 'number',
  boolean: 'boolean',
  temporal: 'date/time',
  nested: 'nested',
  other: 'other',
};

/**
 * Family of a duckdb type name (`VARCHAR`, `DECIMAL(18,3)`, `TIMESTAMP WITH TIME ZONE`,
 * `INTEGER[]`, `STRUCT(...)`...). Order matters: `INTERVAL` contains "INT", so temporal
 * is tested before numeric; nested before everything since `INTEGER[]` also contains "INT".
 */
export function typeGroup(dataType: unknown): TypeGroup {
  if (typeof dataType !== 'string') return 'other';
  const t = dataType.trim().toUpperCase();
  if (!t) return 'other';
  if (t.endsWith(']') || /^(STRUCT|LIST|MAP|UNION|ARRAY)\b/.test(t)) return 'nested';
  if (t.startsWith('BOOL')) return 'boolean';
  if (/^(DATE|TIME|TIMESTAMP|DATETIME|INTERVAL)/.test(t)) return 'temporal';
  if (/^(VARCHAR|CHAR|BPCHAR|TEXT|STRING|UUID|ENUM|NVARCHAR)/.test(t)) return 'text';
  if (/^(U?(TINY|SMALL|BIG|HUGE)?INT|INTEGER|DECIMAL|NUMERIC|DOUBLE|FLOAT|REAL)/.test(t)) return 'numeric';
  return 'other';
}

export interface LabelContext {
  /** Nodes currently drawn. */
  total: number;
  /** Drawn nodes that are not columns (databases, schemas, tables). */
  structural: number;
  selectedId?: string;
  neighbors: Set<string>;
  matches: Set<string>;
  searching: boolean;
}

/** A graph with a couple of hundred nodes reads fine fully labelled; beyond that it turns to soup. */
export const LABEL_ALL_MAX = 120;
export const LABEL_STRUCTURAL_MAX = 400;

/**
 * Whether a node gets a text label. While searching only matches (and the selection) are
 * labelled. Otherwise: everything on a small graph; on a bigger one the structural nodes,
 * unless even those are too many; columns only around the selection.
 */
export function shouldLabel(kind: string, id: string, ctx: LabelContext): boolean {
  if (id === ctx.selectedId) return true;
  if (ctx.searching) return ctx.matches.has(id);
  if (ctx.neighbors.has(id)) return true;
  if (ctx.total <= LABEL_ALL_MAX) return true;
  return kind !== 'column' && ctx.structural <= LABEL_STRUCTURAL_MAX;
}
