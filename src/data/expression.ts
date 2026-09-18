import type { ComparisonOp, Condition, Expression, FieldDef, Group } from './types';

/** Ops that take no value at all. */
const NO_VALUE_OPS: ReadonlySet<ComparisonOp> = new Set(['isNull', 'isNotNull']);
/** Ops that take a two-element [lo, hi] array. */
const RANGE_OPS: ReadonlySet<ComparisonOp> = new Set(['between', 'notBetween']);
/** Ops that take a non-empty array of scalars. */
const LIST_OPS: ReadonlySet<ComparisonOp> = new Set(['in', 'notIn']);

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (should not happen in
  // browser or modern Node, but keep this from throwing).
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function buildFieldMap(fields: FieldDef[]): Map<string, FieldDef> {
  return new Map(fields.map((f) => [f.name, f]));
}

export function emptyCondition(field = ''): Condition {
  return {
    kind: 'condition',
    id: genId(),
    field,
    op: 'eq',
    value: undefined,
  };
}

export function emptyGroup(combinator: 'and' | 'or' = 'and'): Group {
  return {
    kind: 'group',
    id: genId(),
    combinator,
    negated: false,
    children: [],
  };
}

/* --------------------------------------------------------------------- */
/* toSql                                                                  */
/* --------------------------------------------------------------------- */

export interface SqlResult {
  sql: string;
  params: unknown[];
}

/**
 * Compile an Expression tree into a parameterized SQL fragment.
 * Values are NEVER string-interpolated — they come back as `?` placeholders
 * with a matching `params` array. Field names are validated against `fields`
 * and quoted as identifiers; unknown fields throw.
 */
export function toSql(expr: Expression, fields: FieldDef[]): SqlResult {
  const fieldMap = buildFieldMap(fields);
  return walk(expr, fieldMap);
}

function walk(expr: Expression, fieldMap: Map<string, FieldDef>): SqlResult {
  return expr.kind === 'condition' ? conditionSql(expr, fieldMap) : groupSql(expr, fieldMap);
}

function requireField(field: string, fieldMap: Map<string, FieldDef>): FieldDef {
  const def = fieldMap.get(field);
  if (!def) {
    throw new Error(`Unknown field: ${field}`);
  }
  return def;
}

function conditionSql(cond: Condition, fieldMap: Map<string, FieldDef>): SqlResult {
  const def = requireField(cond.field, fieldMap);
  const ident = quoteIdent(def.name);

  switch (cond.op) {
    case 'eq':
      return { sql: `${ident} = ?`, params: [cond.value] };
    case 'neq':
      return { sql: `${ident} != ?`, params: [cond.value] };
    case 'gt':
      return { sql: `${ident} > ?`, params: [cond.value] };
    case 'gte':
      return { sql: `${ident} >= ?`, params: [cond.value] };
    case 'lt':
      return { sql: `${ident} < ?`, params: [cond.value] };
    case 'lte':
      return { sql: `${ident} <= ?`, params: [cond.value] };
    case 'contains':
      return { sql: `${ident} LIKE '%'||?||'%'`, params: [cond.value] };
    case 'notContains':
      return { sql: `NOT (${ident} LIKE '%'||?||'%')`, params: [cond.value] };
    case 'startsWith':
      return { sql: `${ident} LIKE ?||'%'`, params: [cond.value] };
    case 'notStartsWith':
      return { sql: `NOT (${ident} LIKE ?||'%')`, params: [cond.value] };
    case 'endsWith':
      return { sql: `${ident} LIKE '%'||?`, params: [cond.value] };
    case 'notEndsWith':
      return { sql: `NOT (${ident} LIKE '%'||?)`, params: [cond.value] };
    case 'like':
      return { sql: `${ident} LIKE ?`, params: [cond.value] };
    case 'notLike':
      return { sql: `${ident} NOT LIKE ?`, params: [cond.value] };
    case 'in': {
      const arr = asArray(cond.value);
      return { sql: `${ident} IN (${arr.map(() => '?').join(',')})`, params: arr };
    }
    case 'notIn': {
      const arr = asArray(cond.value);
      return { sql: `${ident} NOT IN (${arr.map(() => '?').join(',')})`, params: arr };
    }
    case 'between': {
      const [lo, hi] = asArray(cond.value);
      return { sql: `${ident} BETWEEN ? AND ?`, params: [lo, hi] };
    }
    case 'notBetween': {
      const [lo, hi] = asArray(cond.value);
      return { sql: `${ident} NOT BETWEEN ? AND ?`, params: [lo, hi] };
    }
    case 'isNull':
      return { sql: `${ident} IS NULL`, params: [] };
    case 'isNotNull':
      return { sql: `${ident} IS NOT NULL`, params: [] };
    default: {
      const _exhaustive: never = cond.op;
      throw new Error(`Unsupported operator: ${_exhaustive as string}`);
    }
  }
}

function asArray(value: Condition['value']): Array<string | number | boolean | null> {
  if (Array.isArray(value)) return value;
  return value === undefined ? [] : [value];
}

function groupSql(group: Group, fieldMap: Map<string, FieldDef>): SqlResult {
  if (group.children.length === 0) {
    // Neutral element: an empty group filters nothing.
    return group.negated ? { sql: 'NOT (1=1)', params: [] } : { sql: '1=1', params: [] };
  }

  const parts = group.children.map((child) => walk(child, fieldMap));
  const combinatorSql = ` ${group.combinator.toUpperCase()} `;
  const sql = parts.map((p) => `(${p.sql})`).join(combinatorSql);
  const params = parts.flatMap((p) => p.params);

  return group.negated ? { sql: `NOT (${sql})`, params } : { sql, params };
}

/* --------------------------------------------------------------------- */
/* toHumanString                                                          */
/* --------------------------------------------------------------------- */

const OP_HUMAN: Record<ComparisonOp, string> = {
  eq: '=',
  neq: '≠',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  contains: 'contains',
  notContains: 'does not contain',
  startsWith: 'starts with',
  notStartsWith: 'does not start with',
  endsWith: 'ends with',
  notEndsWith: 'does not end with',
  like: 'like',
  notLike: 'not like',
  in: 'in',
  notIn: 'not in',
  between: 'between',
  notBetween: 'not between',
  isNull: 'is empty',
  isNotNull: 'is not empty',
};

function humanValue(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`;
  if (Array.isArray(value)) return `[${value.map(humanValue).join(', ')}]`;
  return String(value);
}

export function toHumanString(expr: Expression, fields: FieldDef[]): string {
  const fieldMap = buildFieldMap(fields);
  return walkHuman(expr, fieldMap);
}

function walkHuman(expr: Expression, fieldMap: Map<string, FieldDef>): string {
  if (expr.kind === 'condition') {
    const def = fieldMap.get(expr.field);
    const label = def?.label ?? expr.field ?? '<unknown field>';
    const opText = OP_HUMAN[expr.op] ?? expr.op;

    if (NO_VALUE_OPS.has(expr.op)) {
      return `${label} ${opText}`;
    }
    if (RANGE_OPS.has(expr.op)) {
      const [lo, hi] = asArray(expr.value as Condition['value']);
      return `${label} ${opText} ${humanValue(lo)} and ${humanValue(hi)}`;
    }
    return `${label} ${opText} ${humanValue(expr.value)}`;
  }

  if (expr.children.length === 0) {
    return expr.negated ? 'NOT (true)' : 'true';
  }

  const inner = expr.children
    .map((child) => walkHuman(child, fieldMap))
    .join(` ${expr.combinator.toUpperCase()} `);
  const wrapped = expr.children.length > 1 ? `(${inner})` : inner;
  return expr.negated ? `NOT ${wrapped}` : wrapped;
}

/* --------------------------------------------------------------------- */
/* validate                                                               */
/* --------------------------------------------------------------------- */

export function validate(expr: Expression, fields: FieldDef[]): string[] {
  const fieldMap = buildFieldMap(fields);
  const errors: string[] = [];
  walkValidate(expr, fieldMap, errors);
  return errors;
}

function walkValidate(expr: Expression, fieldMap: Map<string, FieldDef>, errors: string[]): void {
  if (expr.kind === 'group') {
    for (const child of expr.children) {
      walkValidate(child, fieldMap, errors);
    }
    return;
  }

  const def = fieldMap.get(expr.field);
  if (!def) {
    errors.push(`Unknown field: ${expr.field || '(none selected)'}`);
    return;
  }

  if (NO_VALUE_OPS.has(expr.op)) {
    return;
  }

  if (RANGE_OPS.has(expr.op)) {
    const arr = Array.isArray(expr.value) ? expr.value : [];
    if (arr.length !== 2 || arr[0] === undefined || arr[0] === null || arr[1] === undefined || arr[1] === null) {
      errors.push(`"${def.label ?? def.name}" needs both a low and a high value`);
    }
    return;
  }

  if (LIST_OPS.has(expr.op)) {
    const arr = Array.isArray(expr.value) ? expr.value : [];
    if (arr.length === 0) {
      errors.push(`"${def.label ?? def.name}" needs at least one value`);
    }
    return;
  }

  if (expr.value === undefined || expr.value === null || expr.value === '') {
    errors.push(`"${def.label ?? def.name}" needs a value`);
  }
}
