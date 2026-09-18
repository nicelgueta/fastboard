import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDataSourcesConfig, DEFAULT_DATA_SOURCES_CONFIG } from './dataSourcesConfig';

describe('getDataSourcesConfig', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('falls back to the default (duckdb only) when the endpoint is not implemented', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' }));
        const config = await getDataSourcesConfig(true);
        expect(config).toEqual(DEFAULT_DATA_SOURCES_CONFIG);
        expect(config.dataSources).toHaveLength(1);
        expect(config.dataSources[0].kind).toBe('duckdb');
    });

    it('falls back to the default when fetch throws (network error / offline)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
        const config = await getDataSourcesConfig(true);
        expect(config).toEqual(DEFAULT_DATA_SOURCES_CONFIG);
    });

    it('falls back to the default when the response is malformed', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ notDataSources: [] }),
        }));
        const config = await getDataSourcesConfig(true);
        expect(config).toEqual(DEFAULT_DATA_SOURCES_CONFIG);
    });

    it('returns the fetched config when the endpoint is implemented and well-formed', async () => {
        const remote = {
            dataSources: [
                { id: 'duckdb', kind: 'duckdb', label: 'DuckDB', tables: [] },
                { id: 'snowflake-prod', kind: 'snowflake', label: 'Snowflake (prod)', tables: [{ name: 'orders' }] },
            ],
        };
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => remote,
        }));
        const config = await getDataSourcesConfig(true);
        expect(config).toEqual(remote);
    });

    it('caches the result across calls until forced', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });
        vi.stubGlobal('fetch', fetchMock);
        await getDataSourcesConfig(true);
        await getDataSourcesConfig();
        await getDataSourcesConfig();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
