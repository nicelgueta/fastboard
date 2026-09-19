/**
 * Clipboard formatting for the table's right-click menu. Kept free of ag-grid
 * and React so it can be unit tested in node (same split as colDefs.ts).
 */

export interface CopyColumn {
    field: string;
    header?: string;
}

/** JSON.stringify replacer: bigint (Arrow int64) has no JSON form, and Dates become ISO strings. */
const jsonReplacer = (_key: string, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value;

/** A cell as plain text: what you'd paste into a spreadsheet. null/undefined copy as empty. */
export function cellToText(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value, jsonReplacer);
    return String(value);
}

/** RFC 4180 field: quoted when it holds a comma, quote, CR or LF; quotes doubled. */
function csvField(text: string): string {
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** One data row as CSV, in the given column order. No header, no trailing newline. */
export function rowToCsv(row: Record<string, unknown>, columns: CopyColumn[]): string {
    return columns.map((c) => csvField(cellToText(row[c.field]))).join(',');
}

/** One row as a pretty-printed JSON object with keys in column order. */
export function rowToJson(row: Record<string, unknown>, columns: CopyColumn[]): string {
    const ordered: Record<string, unknown> = {};
    for (const c of columns) ordered[c.field] = row[c.field] ?? null;
    return JSON.stringify(ordered, jsonReplacer, 2);
}
