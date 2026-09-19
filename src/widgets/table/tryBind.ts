import type { DataSourceKind } from '../../data/dataSourcesConfig';
import { getEngine } from '../../data/engines';
import type { DataSource, TableSchema } from '../../data/types';

export type BindResult =
    | { ok: true; source: DataSource; schema: TableSchema }
    /** `why` is a short, user-presentable reason. */
    | { ok: false; why: string };

/**
 * Bind to `tableName` in the engine for `kind`, never throwing: every way it can
 * fail (no client for that kind, an invalid name, the table not existing - the
 * normal case after a board reload, since the engines are in-memory) comes back
 * as `{ ok: false, why }` so the widget can reset itself.
 */
export async function tryBind(
    kind: DataSourceKind,
    tableName: string,
    lookupEngine: typeof getEngine = getEngine,
): Promise<BindResult> {
    const engine = lookupEngine(kind);
    if (!engine) return { ok: false, why: `no client for data source kind "${kind}"` };
    try {
        const source = engine.createSource(tableName);
        return { ok: true, source, schema: await source.getSchema() };
    } catch (e) {
        return { ok: false, why: e instanceof Error ? e.message : String(e) };
    }
}
