import { describe, expect, it } from 'vitest';
import { emptyCondition, emptyGroup, toHumanString, toSql, validate } from './expression';
import type { Condition, FieldDef, Group } from './types';

const fields: FieldDef[] = [
  { name: 'a', type: 'string' },
  { name: 'b', type: 'integer' },
  { name: 'c', type: 'number' },
  { name: 'active', type: 'boolean' },
  { name: 'created', type: 'date' },
  { name: 'status', type: 'categorical', categories: [{ label: 'Open', value: 'open' }] },
];

function cond(partial: Partial<Condition> & Pick<Condition, 'field' | 'op'>): Condition {
  return { kind: 'condition', id: `id-${Math.random()}`, value: undefined, ...partial };
}

describe('toSql — every operator', () => {
  it('eq', () => {
    expect(toSql(cond({ field: 'a', op: 'eq', value: 'x' }), fields)).toEqual({
      sql: '"a" = ?',
      params: ['x'],
    });
  });

  it('neq', () => {
    expect(toSql(cond({ field: 'a', op: 'neq', value: 'x' }), fields)).toEqual({
      sql: '"a" != ?',
      params: ['x'],
    });
  });

  it('gt', () => {
    expect(toSql(cond({ field: 'b', op: 'gt', value: 5 }), fields)).toEqual({
      sql: '"b" > ?',
      params: [5],
    });
  });

  it('gte', () => {
    expect(toSql(cond({ field: 'b', op: 'gte', value: 5 }), fields)).toEqual({
      sql: '"b" >= ?',
      params: [5],
    });
  });

  it('lt', () => {
    expect(toSql(cond({ field: 'b', op: 'lt', value: 5 }), fields)).toEqual({
      sql: '"b" < ?',
      params: [5],
    });
  });

  it('lte', () => {
    expect(toSql(cond({ field: 'b', op: 'lte', value: 5 }), fields)).toEqual({
      sql: '"b" <= ?',
      params: [5],
    });
  });

  it('contains', () => {
    expect(toSql(cond({ field: 'a', op: 'contains', value: 'x' }), fields)).toEqual({
      sql: `"a" LIKE '%'||?||'%'`,
      params: ['x'],
    });
  });

  it('notContains', () => {
    expect(toSql(cond({ field: 'a', op: 'notContains', value: 'x' }), fields)).toEqual({
      sql: `NOT ("a" LIKE '%'||?||'%')`,
      params: ['x'],
    });
  });

  it('startsWith', () => {
    expect(toSql(cond({ field: 'a', op: 'startsWith', value: 'x' }), fields)).toEqual({
      sql: `"a" LIKE ?||'%'`,
      params: ['x'],
    });
  });

  it('notStartsWith', () => {
    expect(toSql(cond({ field: 'a', op: 'notStartsWith', value: 'x' }), fields)).toEqual({
      sql: `NOT ("a" LIKE ?||'%')`,
      params: ['x'],
    });
  });

  it('endsWith', () => {
    expect(toSql(cond({ field: 'a', op: 'endsWith', value: 'x' }), fields)).toEqual({
      sql: `"a" LIKE '%'||?`,
      params: ['x'],
    });
  });

  it('notEndsWith', () => {
    expect(toSql(cond({ field: 'a', op: 'notEndsWith', value: 'x' }), fields)).toEqual({
      sql: `NOT ("a" LIKE '%'||?)`,
      params: ['x'],
    });
  });

  it('like', () => {
    expect(toSql(cond({ field: 'a', op: 'like', value: '%x%' }), fields)).toEqual({
      sql: '"a" LIKE ?',
      params: ['%x%'],
    });
  });

  it('notLike', () => {
    expect(toSql(cond({ field: 'a', op: 'notLike', value: '%x%' }), fields)).toEqual({
      sql: '"a" NOT LIKE ?',
      params: ['%x%'],
    });
  });

  it('in', () => {
    expect(toSql(cond({ field: 'b', op: 'in', value: [1, 2, 3] }), fields)).toEqual({
      sql: '"b" IN (?,?,?)',
      params: [1, 2, 3],
    });
  });

  it('notIn', () => {
    expect(toSql(cond({ field: 'b', op: 'notIn', value: [1, 2] }), fields)).toEqual({
      sql: '"b" NOT IN (?,?)',
      params: [1, 2],
    });
  });

  it('between', () => {
    expect(toSql(cond({ field: 'b', op: 'between', value: [5, 10] }), fields)).toEqual({
      sql: '"b" BETWEEN ? AND ?',
      params: [5, 10],
    });
  });

  it('notBetween', () => {
    expect(toSql(cond({ field: 'b', op: 'notBetween', value: [5, 10] }), fields)).toEqual({
      sql: '"b" NOT BETWEEN ? AND ?',
      params: [5, 10],
    });
  });

  it('isNull', () => {
    expect(toSql(cond({ field: 'a', op: 'isNull' }), fields)).toEqual({
      sql: '"a" IS NULL',
      params: [],
    });
  });

  it('isNotNull', () => {
    expect(toSql(cond({ field: 'a', op: 'isNotNull' }), fields)).toEqual({
      sql: '"a" IS NOT NULL',
      params: [],
    });
  });
});

describe('toSql — identifier safety', () => {
  it('rejects unknown fields', () => {
    expect(() => toSql(cond({ field: 'nope', op: 'eq', value: 1 }), fields)).toThrow(
      /Unknown field/,
    );
  });

  it('quotes field names as identifiers, never interpolates values into the identifier position', () => {
    const injection = `x'; DROP TABLE a; --`;
    const result = toSql(cond({ field: 'a', op: 'eq', value: injection }), fields);
    // the malicious string must appear only as a bound param, never inline in the sql text
    expect(result.sql).toBe('"a" = ?');
    expect(result.params).toEqual([injection]);
    expect(result.sql).not.toContain('DROP TABLE');
  });
});

describe('toSql — nested groups, mixed combinators, negation', () => {
  it('compiles a three-level nested group: (a contains "x" OR b in [1,2]) wrapped a level deeper, AND NOT (c between 5 and 10)', () => {
    // Level 3 group (innermost): OR of two conditions
    const level3: Group = {
      kind: 'group',
      id: 'g3',
      combinator: 'or',
      children: [
        cond({ id: 'condA', field: 'a', op: 'contains', value: 'x' }),
        cond({ id: 'condB', field: 'b', op: 'in', value: [1, 2] }),
      ],
    };
    // Level 2 group: wraps level 3 (adds a genuine third level of nesting)
    const level2: Group = {
      kind: 'group',
      id: 'g2',
      combinator: 'and',
      children: [level3],
    };
    // A separate negated group at the root's level
    const notGroup: Group = {
      kind: 'group',
      id: 'g-not',
      combinator: 'and',
      negated: true,
      children: [cond({ id: 'condC', field: 'c', op: 'between', value: [5, 10] })],
    };
    // Root group: AND of level2 and notGroup
    const root: Group = {
      kind: 'group',
      id: 'root',
      combinator: 'and',
      children: [level2, notGroup],
    };

    const result = toSql(root, fields);

    expect(result.sql).toBe(
      `((("a" LIKE '%'||?||'%') OR ("b" IN (?,?)))) AND (NOT (("c" BETWEEN ? AND ?)))`,
    );
    expect(result.params).toEqual(['x', 1, 2, 5, 10]);
  });

  it('handles an empty group as a neutral filter, and a negated empty group as always-false', () => {
    const empty = emptyGroup('and');
    expect(toSql(empty, fields)).toEqual({ sql: '1=1', params: [] });

    const negatedEmpty: Group = { ...emptyGroup('and'), negated: true };
    expect(toSql(negatedEmpty, fields)).toEqual({ sql: 'NOT (1=1)', params: [] });
  });
});

describe('toHumanString', () => {
  it('renders a readable summary with labels, combinators and negation', () => {
    const group: Group = {
      kind: 'group',
      id: 'root',
      combinator: 'and',
      children: [
        cond({ field: 'a', op: 'contains', value: 'x' }),
        { ...emptyGroup('or'), negated: true, children: [cond({ field: 'b', op: 'eq', value: 1 })] },
      ],
    };
    const human = toHumanString(group, fields);
    expect(human).toContain('a contains "x"');
    expect(human).toContain('NOT');
    expect(human).toContain('b = 1');
  });
});

describe('validate', () => {
  it('flags unknown fields, missing values, and malformed between/in payloads', () => {
    const group: Group = {
      kind: 'group',
      id: 'root',
      combinator: 'and',
      children: [
        cond({ field: 'nope', op: 'eq', value: 1 }),
        cond({ field: 'a', op: 'eq', value: undefined }),
        cond({ field: 'b', op: 'between', value: [5] }),
        cond({ field: 'b', op: 'in', value: [] }),
        cond({ field: 'a', op: 'isNull' }),
      ],
    };
    const errors = validate(group, fields);
    expect(errors.length).toBeGreaterThanOrEqual(4);
    expect(errors.some((e) => e.includes('Unknown field'))).toBe(true);
  });

  it('passes for a well-formed expression', () => {
    const group: Group = {
      kind: 'group',
      id: 'root',
      combinator: 'and',
      children: [cond({ field: 'a', op: 'contains', value: 'x' })],
    };
    expect(validate(group, fields)).toEqual([]);
  });
});

describe('emptyGroup / emptyCondition', () => {
  it('produce fresh, stable ids each call', () => {
    const g1 = emptyGroup();
    const g2 = emptyGroup();
    expect(g1.id).not.toBe(g2.id);
    expect(g1.kind).toBe('group');
    expect(g1.children).toEqual([]);

    const c1 = emptyCondition();
    const c2 = emptyCondition();
    expect(c1.id).not.toBe(c2.id);
    expect(c1.kind).toBe('condition');
  });
});
