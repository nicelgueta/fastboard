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

export interface QueryResult {
  rows: Record<string, unknown>[];
  totalRows: number;
}

/** Implement this to plug any backend into the table widget. */
export interface DataSource {
  readonly id: string;
  readonly label: string;
  getSchema(): Promise<TableSchema>;
  /** Lazily resolve categories for a categorical field (SELECT DISTINCT under the hood). */
  getCategories?(field: string): Promise<Array<{ label: string; value: string | number }>>;
  query(req: QueryRequest): Promise<QueryResult>;
  /** Optional: expose the source under a name the SQL editor can query. */
  sqlName?: string;
}
