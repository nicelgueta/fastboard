import { describe, expect, it } from 'vitest';
import type { CatalogGraph } from './catalog';
import {
  computeDegrees,
  computeLevels,
  countByKind,
  escapeHtml,
  limitDepth,
  matchNodes,
  mergeGraphs,
  neighborIds,
  shouldLabel,
  typeGroup,
  type LabelContext,
} from './graphModel';
import { buildCatalogGraph, columnId, dbId, schemaId, tableId } from './DuckDbCatalogSource';
import { mixCss, parseCssColor, toHex } from '../../utils/color';

const g: CatalogGraph = {
  nodes: [
    { id: 'd', label: 'memory', kind: 'database' },
    { id: 's', label: 'main', kind: 'schema' },
    { id: 't1', label: 'orders', kind: 'table' },
    { id: 't2', label: 'customers', kind: 'table' },
    { id: 'c1', label: 'order_id', kind: 'column' },
  ],
  links: [
    { source: 'd', target: 's', relation: 'contains' },
    { source: 's', target: 't1', relation: 'contains' },
    { source: 's', target: 't2', relation: 'contains' },
    { source: 't1', target: 'c1', relation: 'contains' },
  ],
};

describe('computeLevels / limitDepth', () => {
  it('levels a catalog from its roots down', () => {
    const lv = computeLevels(g);
    expect([lv.get('d'), lv.get('s'), lv.get('t1'), lv.get('c1')]).toEqual([0, 1, 2, 3]);
  });

  it('caps depth and drops links to removed nodes', () => {
    const cut = limitDepth(g, 2);
    expect(cut.nodes.map((n) => n.id)).toEqual(['d', 's', 't1', 't2']);
    expect(cut.links).toHaveLength(3);
    expect(limitDepth(g, 0).nodes.map((n) => n.id)).toEqual(['d']);
    expect(limitDepth(g, 0).links).toEqual([]);
  });

  it('never loses nodes that sit in a pure cycle', () => {
    const cyc: CatalogGraph = {
      nodes: [{ id: 'a', label: 'a', kind: 'x' }, { id: 'b', label: 'b', kind: 'x' }],
      links: [{ source: 'a', target: 'b', relation: 'r' }, { source: 'b', target: 'a', relation: 'r' }],
    };
    expect(limitDepth(cyc, 0).nodes).toHaveLength(2);
  });

  it('ignores links that point at unknown nodes', () => {
    const bad: CatalogGraph = { nodes: [{ id: 'a', label: 'a', kind: 'x' }], links: [{ source: 'a', target: 'zz', relation: 'r' }] };
    expect(computeLevels(bad).get('a')).toBe(0);
  });
});

describe('degrees, neighbours, search, merge', () => {
  it('counts links in either direction', () => {
    const d = computeDegrees(g);
    expect(d.get('s')).toBe(3);
    expect(d.get('c1')).toBe(1);
  });

  it('finds neighbours both ways', () => {
    expect([...neighborIds(g, 't1')].sort()).toEqual(['c1', 's']);
  });

  it('matches by label substring or exact kind, case-insensitively; empty matches nothing', () => {
    expect([...matchNodes(g.nodes, 'ORDER')].sort()).toEqual(['c1', 't1']);
    expect([...matchNodes(g.nodes, 'table')].sort()).toEqual(['t1', 't2']);
    expect(matchNodes(g.nodes, '  ').size).toBe(0);
  });

  it('merges without duplicating nodes or links', () => {
    const merged = mergeGraphs(g, {
      nodes: [{ id: 'c1', label: 'dup', kind: 'column' }, { id: 'c2', label: 'new', kind: 'column' }],
      links: [{ source: 't1', target: 'c1', relation: 'contains' }, { source: 't1', target: 'c2', relation: 'contains' }],
    });
    expect(merged.nodes).toHaveLength(6);
    expect(merged.nodes.find((n) => n.id === 'c1')!.label).toBe('order_id');
    expect(merged.links).toHaveLength(5);
  });

  it('counts by kind', () => {
    expect(countByKind(g)).toEqual({ database: 1, schema: 1, table: 2, column: 1 });
  });

  it('escapes html in labels', () => {
    expect(escapeHtml(`<img src=x onerror="a('b')">&`)).toBe('&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
  });
});

describe('buildCatalogGraph (duckdb catalog rows)', () => {
  const rows = {
    databases: [{ database_name: 'memory' }],
    schemas: [{ database_name: 'memory', schema_name: 'main' }],
    tables: [
      { database_name: 'memory', schema_name: 'main', table_name: 'a.b', estimated_size: 12n, column_count: 2n },
      // parent schema does not exist: dropped, not left dangling
      { database_name: 'ghost', schema_name: 'main', table_name: 'x' },
    ],
    columns: [
      { database_name: 'memory', schema_name: 'main', table_name: 'a.b', column_name: 'id', column_index: 1n, data_type: 'INTEGER', is_nullable: false },
      // a view's column: no such table, dropped
      { database_name: 'memory', schema_name: 'main', table_name: 'some_view', column_name: 'v' },
    ],
  };
  const out = buildCatalogGraph(rows);

  it('builds database -> schema -> table -> column with contains links', () => {
    expect(out.nodes.map((n) => n.kind)).toEqual(['database', 'schema', 'table', 'column']);
    expect(out.links.map((l) => [l.source, l.target])).toEqual([
      [dbId('memory'), schemaId('memory', 'main')],
      [schemaId('memory', 'main'), tableId('memory', 'main', 'a.b')],
      [tableId('memory', 'main', 'a.b'), columnId('memory', 'main', 'a.b', 'id')],
    ]);
    expect(out.links.every((l) => l.relation === 'contains')).toBe(true);
  });

  it('turns bigint meta into plain numbers so it is displayable and serialisable', () => {
    const table = out.nodes.find((n) => n.kind === 'table')!;
    expect(table.meta).toMatchObject({ estimatedRows: 12, columns: 2 });
    expect(() => JSON.stringify(out)).not.toThrow();
    expect(out.nodes.find((n) => n.kind === 'column')!.meta).toMatchObject({ type: 'INTEGER', nullable: false, position: 1 });
  });

  it('ids stay unique when names contain separators', () => {
    expect(tableId('d', 's.t', 'x')).not.toBe(tableId('d', 's', 't.x'));
  });
});

describe('colour helpers', () => {
  it('parses rgba and hex, dropping alpha', () => {
    expect(parseCssColor('rgba(10, 20, 30, 0.5)')).toEqual([10, 20, 30]);
    expect(parseCssColor('#abc')).toEqual([170, 187, 204]);
    expect(toHex('rgb(255, 0, 128)')).toBe('#ff0080');
  });
  it('mixes', () => {
    expect(mixCss('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixCss('#102030', '#ffffff', 0)).toBe('#102030');
  });
});

describe('typeGroup', () => {
  it.each([
    ['VARCHAR', 'text'], ['UUID', 'text'], ['ENUM(\'a\', \'b\')', 'text'],
    ['INTEGER', 'numeric'], ['BIGINT', 'numeric'], ['UBIGINT', 'numeric'], ['HUGEINT', 'numeric'], ['TINYINT', 'numeric'],
    ['DOUBLE', 'numeric'], ['FLOAT', 'numeric'], ['DECIMAL(18,3)', 'numeric'],
    ['BOOLEAN', 'boolean'],
    ['DATE', 'temporal'], ['TIME', 'temporal'], ['TIMESTAMP', 'temporal'], ['TIMESTAMP WITH TIME ZONE', 'temporal'], ['INTERVAL', 'temporal'],
    ['INTEGER[]', 'nested'], ['STRUCT(a INTEGER)', 'nested'], ['MAP(VARCHAR, INTEGER)', 'nested'], ['VARCHAR[3]', 'nested'],
    ['BLOB', 'other'], ['', 'other'],
  ])('%s -> %s', (t, g) => expect(typeGroup(t)).toBe(g));

  it('tolerates a missing type and lower case', () => {
    expect(typeGroup(undefined)).toBe('other');
    expect(typeGroup(42)).toBe('other');
    expect(typeGroup('varchar')).toBe('text');
  });
});

describe('shouldLabel', () => {
  const ctx = (over: Partial<LabelContext> = {}): LabelContext => ({
    total: 10, structural: 4, neighbors: new Set(), matches: new Set(), searching: false, ...over,
  });
  it('labels everything on a small graph', () => {
    expect(shouldLabel('column', 'a', ctx())).toBe(true);
  });
  it('on a bigger graph labels structure but not columns', () => {
    const big = ctx({ total: 1000, structural: 50 });
    expect(shouldLabel('table', 't', big)).toBe(true);
    expect(shouldLabel('column', 'c', big)).toBe(false);
  });
  it('on a huge graph labels nothing by default', () => {
    expect(shouldLabel('table', 't', ctx({ total: 9000, structural: 2000 }))).toBe(false);
  });
  it('columns beside the selection are labelled, the selection always is', () => {
    const big = ctx({ total: 1000, structural: 50, selectedId: 's', neighbors: new Set(['c1']) });
    expect(shouldLabel('column', 'c1', big)).toBe(true);
    expect(shouldLabel('column', 'c2', big)).toBe(false);
    expect(shouldLabel('column', 's', big)).toBe(true);
  });
  it('while searching, only matches carry labels', () => {
    const s = ctx({ searching: true, matches: new Set(['m']) });
    expect(shouldLabel('table', 'm', s)).toBe(true);
    expect(shouldLabel('table', 'other', s)).toBe(false);
  });
});
