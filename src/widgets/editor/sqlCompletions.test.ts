import { describe, it, expect } from 'vitest';
import { tableWidgetsToCompletionSources } from './sqlCompletions';

describe('tableWidgetsToCompletionSources', () => {
  it('drops entries without a tableName', () => {
    const result = tableWidgetsToCompletionSources([
      undefined,
      {},
      { tableName: undefined, schema: { name: 'x', fields: [] } },
    ] as any);
    expect(result).toEqual([]);
  });

  it('maps schema fields to column names', () => {
    const result = tableWidgetsToCompletionSources([
      {
        tableName: 'orders',
        schema: {
          name: 'orders',
          fields: [{ name: 'id', type: 'integer' }, { name: 'total', type: 'number' }],
        },
      },
    ] as any);
    expect(result).toEqual([{ tableName: 'orders', columns: ['id', 'total'] }]);
  });

  it('handles a table with no schema yet (columns empty)', () => {
    const result = tableWidgetsToCompletionSources([{ tableName: 'pending' }] as any);
    expect(result).toEqual([{ tableName: 'pending', columns: [] }]);
  });
});
