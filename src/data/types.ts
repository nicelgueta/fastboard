/**
 * Data source contracts for FastBoard.
 *
 * This file is a hard contract consumed by Phase 6 (table widget / expression
 * builder) and Phase 7 (SQL editor widget). Keep it stable — additive changes
 * only unless a churn is explicitly agreed.
 */

export type FieldType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'date'
  | 'timestamp'
  | 'categorical';

export interface FieldDef {
  name: string;
  label?: string;
  type: FieldType;
  nullable?: boolean;
  /** Required when type === 'categorical'. Drives the value dropdown in the expression builder. */
  categories?: Array<{ label: string; value: string | number }>;
}

export interface TableSchema {
  name: string;
  fields: FieldDef[];
  rowCount?: number;
}

/* ---- Expression AST: what the builder produces and a source consumes ---- */
export type ComparisonOp =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'notStartsWith'
  | 'endsWith'
  | 'notEndsWith'
  | 'like'
  | 'notLike'
  | 'in'
  | 'notIn'
  | 'between'
  | 'notBetween'
  | 'isNull'
  | 'isNotNull';

export interface Condition {
  kind: 'condition';
  id: string;
  field: string;
  op: ComparisonOp;
  /** scalar for most ops; array for in/notIn; [lo,hi] for between; absent for isNull/isNotNull. */
  value?: string | number | boolean | Array<string | number> | null;
}

export interface Group {
  kind: 'group';
  id: string;
  combinator: 'and' | 'or';
  /** NOT (...) */
  negated?: boolean;
  /** nesting is unbounded */
  children: Expression[];
}

export type Expression = Condition | Group;

export interface SortSpec {
  field: string;
  direction: 'asc' | 'desc';
}

export interface QueryRequest {
  filter?: Expression;
  sort?: SortSpec[];
  offset: number;
  limit: number;
  select?: string[];
}

/**
 * Wire format of a query result.
 *
 * The interface is deliberately columnar bytes, not JSON rows: an Expression
 * goes out, Arrow (or Parquet) comes back. That is what a remote DataSource
 * would put on the wire, so the local duckdb-wasm implementation and a future
 * HTTP one are the same shape - no JSON round-trip and no per-row object
 * allocation on the transport boundary.
 *
 * Consumers do not parse these bytes by hand: use `resultToRows` /
 * `resultToTable` from `src/data/decode.ts`, which decode Arrow directly and
 * hand Parquet to duckdb. Only convert to JS row objects at the point a view
 * actually needs them (e.g. feeding ag-grid).
 */
export type ResultFormat = 'arrow-ipc' | 'parquet';

export interface QueryResult {
  format: ResultFormat;
  /** Arrow IPC stream bytes, or a Parquet file's bytes. */
  bytes: Uint8Array;
  /** Total rows matching the filter, ignoring limit/offset - drives pagination. */
  totalRows: number;
  /** Schema of the returned columns, so callers can build column defs without decoding. */
  schema?: TableSchema;
}

/** Implement this to plug any backend into the table widget. */
export interface DataSource {
  readonly id: string;
  readonly label: string;
  getSchema(): Promise<TableSchema>;
  /** Lazily resolve categories for a categorical field (SELECT DISTINCT under the hood). */
  getCategories?(field: string): Promise<Array<{ label: string; value: string | number }>>;
  /** Expression out, columnar bytes back. See QueryResult. */
  query(req: QueryRequest): Promise<QueryResult>;
  /** Optional: expose the source under a name the SQL editor can query. */
  sqlName?: string;
}
