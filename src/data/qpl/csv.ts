import * as arrow from 'apache-arrow';
import Papa from 'papaparse';
import { buildVector, type Layout } from './vectors';

/**
 * CSV -> Arrow, in JS, for the qpl engine (its wasm build has no CSV reader).
 *
 * papaparse handles the format (quoting, embedded newlines, delimiter
 * detection, BOM); this file infers a type per column, since a CSV carries none.
 * Every value starts as text and a column takes the first type, in the order
 * below, that all its non-empty values fit:
 *
 *   boolean -> int64 -> float64 -> date -> timestamp -> string
 *
 * An empty field is null. Numbers with a leading zero ("007") stay text, so
 * ids and zip codes are not mangled. Timestamps have microsecond precision;
 * one without a zone is read as UTC.
 */

type Inferred = { layout: Layout; values: unknown[] };

const BOOL_RE = /^(true|false)$/i;
const INT_RE = /^[+-]?\d+$/;
const FLOAT_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const LEADING_ZERO_RE = /^[+-]?0\d/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIMESTAMP_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}(?::?\d{2})?)?$/;

const INT64_MIN = -(2n ** 63n);
const INT64_MAX = 2n ** 63n - 1n;
const MS_PER_DAY = 86_400_000;

/** Days since the epoch for a valid calendar date, else undefined (2024-02-30, 2024-13-01, ...). */
function daysFromYmd(y: number, m: number, d: number): number | undefined {
    const ms = Date.UTC(y, m - 1, d);
    const back = new Date(ms);
    // Date.UTC rolls an impossible date over; reading the parts back catches that
    if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return undefined;
    return ms / MS_PER_DAY;
}

function parseDate(s: string): number | undefined {
    const m = DATE_RE.exec(s);
    return m ? daysFromYmd(+m[1], +m[2], +m[3]) : undefined;
}

/** Microseconds since the epoch, else undefined. */
function parseTimestamp(s: string): bigint | undefined {
    const m = TIMESTAMP_RE.exec(s);
    if (!m) return undefined;
    const days = daysFromYmd(+m[1], +m[2], +m[3]);
    const [h, min, sec] = [+m[4], +m[5], +(m[6] ?? 0)];
    if (days === undefined || h > 23 || min > 59 || sec > 59) return undefined;
    const micros = BigInt((m[7] ?? '').padEnd(6, '0').slice(0, 6) || 0);
    let seconds = BigInt(days) * 86_400n + BigInt(h * 3600 + min * 60 + sec);
    const zone = m[8];
    if (zone && zone !== 'Z') {
        const sign = zone[0] === '-' ? -1 : 1;
        const digits = zone.slice(1).replace(':', '');
        const offset = +digits.slice(0, 2) * 3600 + +(digits.slice(2) || 0) * 60;
        seconds -= BigInt(sign * offset);
    }
    return seconds * 1_000_000n + micros;
}

const all = (values: (string | null)[], test: (s: string) => boolean) => values.every((v) => v === null || test(v));

function inferColumn(raw: (string | null)[]): Inferred {
    const text = (): Inferred => ({ layout: { kind: 'utf8' }, values: raw });

    // a column with no values at all carries no type information
    if (raw.every((v) => v === null)) return text();

    if (all(raw, (s) => BOOL_RE.test(s))) {
        return { layout: { kind: 'bool' }, values: raw.map((v) => (v === null ? null : v.toLowerCase() === 'true')) };
    }
    // ids and zip codes look numeric but aren't
    if (!all(raw, (s) => !LEADING_ZERO_RE.test(s))) return text();

    if (all(raw, (s) => INT_RE.test(s))) {
        const ints = raw.map((v) => (v === null ? null : BigInt(v)));
        if (ints.every((v) => v === null || (v >= INT64_MIN && v <= INT64_MAX))) {
            return { layout: { kind: 'big', type: new arrow.Int64(), ctor: BigInt64Array }, values: ints };
        }
    }
    if (all(raw, (s) => FLOAT_RE.test(s))) {
        return {
            layout: { kind: 'num', type: new arrow.Float64(), ctor: Float64Array },
            values: raw.map((v) => (v === null ? null : Number(v))),
        };
    }
    if (all(raw, (s) => parseDate(s) !== undefined)) {
        return {
            layout: { kind: 'num', type: new arrow.DateDay(), ctor: Int32Array },
            values: raw.map((v) => (v === null ? null : parseDate(v))),
        };
    }
    if (all(raw, (s) => parseTimestamp(s) !== undefined)) {
        return {
            layout: { kind: 'big', type: new arrow.TimestampMicrosecond(), ctor: BigInt64Array },
            values: raw.map((v) => (v === null ? null : parseTimestamp(v))),
        };
    }
    return text();
}

/** Header cells -> unique, non-empty column names. */
function columnNames(header: string[]): string[] {
    const seen = new Map<string, number>();
    return header.map((h, i) => {
        const base = h.trim() || `column_${i + 1}`;
        const n = (seen.get(base) ?? 0) + 1;
        seen.set(base, n);
        return n === 1 ? base : `${base}_${n}`;
    });
}

/** Parse CSV text (first row = header) into one Arrow table. */
export function csvToArrow(text: string): arrow.Table {
    const parsed = Papa.parse<string[]>(text, { header: false, skipEmptyLines: true });
    // a malformed quote is fatal; ragged rows (too few / too many fields) are tolerated below
    const fatal = parsed.errors.find((e) => e.type === 'Quotes');
    if (fatal) throw new Error(`CSV is malformed (row ${fatal.row ?? '?'}): ${fatal.message}`);
    if (parsed.data.length === 0) throw new Error('The CSV file is empty.');

    const [header, ...rows] = parsed.data;
    const names = columnNames(header);
    const vectors: Record<string, arrow.Vector> = {};
    names.forEach((name, c) => {
        const raw = rows.map((r) => {
            const v = r[c];
            return v === undefined || v === '' ? null : v;
        });
        const { layout, values } = inferColumn(raw);
        vectors[name] = buildVector(values, layout);
    });
    return new arrow.Table(vectors);
}
