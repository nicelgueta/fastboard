import * as arrow from 'apache-arrow';

const MAX_CELL = 40;

function cellText(v: unknown): string {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'bigint') return v.toString();
    const s = String(v);
    return s.length > MAX_CELL ? `${s.slice(0, MAX_CELL - 1)}…` : s;
}

/**
 * Render an arrow table as a box-drawn text table, the way a CLI would print
 * a query result - used by raw mode (no target table widget) in place of
 * pushing arrow-ipc to a table.
 */
export function formatArrowTable(table: arrow.Table, maxRows = 50): string {
    const columns = table.schema.fields.map((f) => f.name);
    if (columns.length === 0) return '(0 columns)';

    const total = table.numRows;
    const shown = Math.min(total, maxRows);
    const rows: string[][] = [];
    for (let i = 0; i < shown; i++) {
        const row = table.get(i);
        rows.push(columns.map((c) => cellText(row?.[c])));
    }

    const widths = columns.map((c, i) => Math.max(c.length, 1, ...rows.map((r) => r[i].length)));
    const line = (l: string, m: string, r: string) => l + widths.map((w) => '─'.repeat(w + 2)).join(m) + r;
    const rowText = (cells: string[]) => `│ ${cells.map((c, i) => c.padEnd(widths[i])).join(' │ ')} │`;

    const out = [line('┌', '┬', '┐'), rowText(columns), line('├', '┼', '┤'), ...rows.map(rowText), line('└', '┴', '┘')];
    if (total > shown) out.push(`… (${total - shown} more rows not shown)`);
    out.push(`(${total} row${total === 1 ? '' : 's'})`);
    return out.join('\n');
}
