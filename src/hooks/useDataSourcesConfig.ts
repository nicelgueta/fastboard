import React from 'react';
import {
    getDataSourcesConfig,
    DEFAULT_DATA_SOURCES_CONFIG,
    type DataSourcesConfig,
} from '../data/dataSourcesConfig';

/** The table widget's data source catalogue - see src/data/dataSourcesConfig.ts. */
const useDataSourcesConfig = (): DataSourcesConfig => {
    const [config, setConfig] = React.useState<DataSourcesConfig>(DEFAULT_DATA_SOURCES_CONFIG);
    React.useEffect(() => {
        let cancelled = false;
        getDataSourcesConfig().then((c) => { if (!cancelled) setConfig(c); });
        return () => { cancelled = true; };
    }, []);
    return config;
};

export default useDataSourcesConfig;
