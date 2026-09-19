import type { Expression, TableSchema, DataSource } from '../data/types';
import type { DataSourceKind } from '../data/dataSourcesConfig';

/**
 * Cross-widget contracts.
 *
 * These are the shapes widgets publish via `usePublishExports` and consume via
 * `useWidgetExports` (see src/store/hooks.ts). They live here, outside either
 * widget's folder, so the table and the editor can be built against the same
 * agreed surface without importing each other.
 */

/** Widget type ids. Also the keys of the component mapping in registry.ts. */
export const WIDGET_TYPE = {
  tradingView: 'tradingView',
  table: 'table',
  editor: 'editor',
  graph: 'graph',
  reddit: 'reddit',
} as const;

/**
 * Published by the data table widget. The SQL editor discovers tables with
 * `useWidgetsByType(WIDGET_TYPE.table)` and drives them through this.
 */
export interface TableWidgetExports {
  /** duckdb table name backing this widget, if one is bound yet. */
  tableName?: string;
  /**
   * The engine the bound table lives in ('duckdb', 'qpl'). The SQL editor runs
   * its text on this engine, in that engine's language, when linked. Absent
   * until a table is bound.
   */
  engine?: DataSourceKind;
  /** Current schema, or undefined before a source is bound. */
  schema?: TableSchema;
  /** The bound source, for callers that want to query it directly. */
  source?: DataSource;
  /** Replace the widget's active filter. */
  applyFilter: (expr: Expression | undefined) => void;
  /**
   * Push an externally produced result set into the grid - this is how the SQL
   * editor displays its query output in a table widget. Arrow IPC bytes, the
   * same format DataSource.query returns (see src/data/types.ts); decode with
   * src/data/decode.ts rather than parsing by hand.
   */
  setResult: (result: TablePushedResult) => void;
  /** Drop a pushed result and return to querying the bound table directly. */
  releaseResult: () => void;
}

/**
 * A result set pushed into a table widget from elsewhere (today: the SQL
 * editor). `source` names the widget that produced it so the table can tell
 * the user what is driving its contents and offer to release it.
 */
export interface TablePushedResult {
  bytes: Uint8Array;
  format: 'arrow-ipc' | 'parquet';
  totalRows: number;
  schema?: TableSchema;
  source?: { wKey: string; name: string };
}

/** Published by the code editor widget. */
export interface EditorWidgetExports {
  language: string;
  getContent: () => string;
  /** wKey of the table widget this editor sends results to, if any. */
  targetWKey?: string;
}

/**
 * Published by the 3D graph explorer, so another widget can follow what the
 * user has selected in the catalog (e.g. a table widget binding to a table node).
 */
export interface GraphWidgetExports {
  selectedNodeId?: string;
  selectedNode?: { id: string; label: string; kind: string; meta?: Record<string, unknown> };
}
