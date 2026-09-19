import React from 'react';
import { Box, HStack, Text, Input as ChakraFileInput, Center, Spinner } from '@chakra-ui/react';
import { AgGridReact } from 'ag-grid-react';
import {
    ModuleRegistry,
    AllCommunityModule,
    themeQuartz,
    colorSchemeDark,
    type Theme,
    type IDatasource,
    type IGetRowsParams,
    type GridApi,
    type GridReadyEvent,
    type PaginationChangedEvent,
} from 'ag-grid-community';
import { useColorMode } from '@chakra-ui/color-mode';
import useAppColors from '../../hooks/useAppColors';
import { stopPropagation } from '../../components/common';
import useUserAlert from '../../hooks/useUserAlert';
import { useWidgetState, usePublishExports, useEditorLinks } from '../../store/hooks';
import ConnectionBadge from '../ConnectionBadge';
import { WidgetElementProps } from '../../interfaces';
import type { TableWidgetExports } from '../types';
import type { DataSource, Expression, FieldDef, FieldType, TableSchema } from '../../data/types';
import { resultToRows } from '../../data/decode';
import { getEngine, DEFAULT_ENGINE_KIND } from '../../data/engines';
import { tryBind } from './tryBind';
import { lastRowFor } from './paging';
import { sanitizeTableName } from '../../data/tableName';
import { toHumanString } from '../../data/expression';
import FBButton from '../../components/primitive/Button';
import FBInput from '../../components/primitive/Input';
import FBSelect from '../../components/primitive/Select';
import ExpressionBuilder from './ExpressionBuilder';
import { schemaToColDefs } from './colDefs';
import { useAppSettings } from '../../store/appSettings';
import type { SortSpec } from '../../data/types';
import type { TablePushedResult } from '../types';
import useDataSourcesConfig from '../../hooks/useDataSourcesConfig';

// Registered once at module scope, per ag-grid v36's Theming/Modules API -
// without this the grid renders nothing (see PLAN.md Phase 6a).
ModuleRegistry.registerModules([AllCommunityModule]);

interface TableWidgetProps extends WidgetElementProps {
    defaultPageSize?: number | string;
    sourceTableName?: string;
    showFilterBar?: boolean;
}

interface TablePersistedState {
    tableName?: string;
    /** Which engine tableName lives in (a DataSourceKind). Absent on boards saved before qpl existed: duckdb. */
    sourceKind?: string;
    filter?: Expression;
    pageSize?: number;
    // Set when the SQL editor (Phase 7) pushed a result via setResult -
    // that result bypasses the bound DataSource / server pagination.
    pushedSchema?: TableSchema;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500];

/**
 * Bound tables use ag-grid's own Infinite Row Model (Community) plus its
 * native pagination UI: the grid asks our IDatasource for startRow/endRow
 * blocks and we translate that 1:1 into DataSource.query({offset, limit}) -
 * duckdb (or a remote backend) does the real paging, the grid never holds
 * more than one page's worth of rows. Sorting comes from the same place
 * (IGetRowsParams.sortModel), so there is no separate sort state to keep in
 * sync - see colDefs.ts's serverSort no-op comparator for why ag-grid's own
 * client-side sort must stay disabled for this row model.
 *
 * A pushed result (SQL editor -> setResult) is the opposite case: the whole
 * result set is already in memory, so that path uses ag-grid's default
 * client-side row model with pagination off (see pushedMode below).
 */
const TableWidget: React.FC<TableWidgetProps> = (props) => {
    const { wKey, isStatic, defaultPageSize, sourceTableName, showFilterBar } = props;
    const [colors] = useAppColors();
    const { colorMode } = useColorMode();
    const alert = useUserAlert();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const gridApiRef = React.useRef<GridApi | null>(null);

    const [state, setState] = useWidgetState<TablePersistedState>(wKey);
    const appDefaultPageSize = useAppSettings((st) => st.table.defaultPageSize);
    const linkedEditor = useEditorLinks()[wKey];

    const initialPageSize = React.useMemo(() => {
        const n = Number(defaultPageSize);
        if (PAGE_SIZE_OPTIONS.includes(n)) return n;
        return PAGE_SIZE_OPTIONS.includes(appDefaultPageSize) ? appDefaultPageSize : 25;
    }, [defaultPageSize, appDefaultPageSize]);

    const pageSize = state.pageSize ?? initialPageSize;
    const filter = state.filter;

    const [source, setSource] = React.useState<DataSource | null>(null);
    const [schema, setSchema] = React.useState<TableSchema | undefined>(undefined);
    const [rows, setRows] = React.useState<Record<string, unknown>[]>([]);
    const [totalRows, setTotalRows] = React.useState(0);
    const [loading, setLoading] = React.useState(false);
    const [tableNameInput, setTableNameInput] = React.useState('');
    const [filterOpen, setFilterOpen] = React.useState(false);

    // Catalogue of bindable data sources (duckdb + whatever a host app
    // describes at /app/table/dataSources) - see dataSourcesConfig.ts.
    const dsConfig = useDataSourcesConfig();
    const [selectedSourceId, setSelectedSourceId] = React.useState('duckdb');
    React.useEffect(() => {
        if (!dsConfig.dataSources.some((d) => d.id === selectedSourceId)) {
            setSelectedSourceId(dsConfig.dataSources[0]?.id ?? 'duckdb');
        }
    }, [dsConfig, selectedSourceId]);
    const selectedSource = dsConfig.dataSources.find((d) => d.id === selectedSourceId);
    const [selectedTable, setSelectedTable] = React.useState('');
    // Which widget pushed the current result set, if any.
    const [pushedSource, setPushedSource] = React.useState<{ wKey: string; name: string } | undefined>();
    // A result pushed externally (e.g. by the SQL editor via setResult) is
    // shown as-is: it has already been limited/offset by whoever produced
    // it, so it bypasses the bound DataSource's own paging entirely.
    const [pushedMode, setPushedMode] = React.useState(false);

    // Read inside the (stable) IDatasource's getRows closure - kept fresh via
    // the effect below rather than recreated per-render, since recreating it
    // would otherwise be the trigger ag-grid uses to reset pagination.
    const sourceRef = React.useRef<DataSource | null>(null);
    const filterRef = React.useRef<Expression | undefined>(undefined);
    React.useEffect(() => { sourceRef.current = source; }, [source]);
    React.useEffect(() => { filterRef.current = filter; }, [filter]);

    // Bind (or rebind) the DataSource whenever the persisted table name or
    // engine changes - including on mount when restoring from a saved board.
    //
    // A board saves which table a widget was bound to, not the table: both
    // engines are in-memory, so after a reload the table is gone. Any failure to
    // bind therefore resets the widget to its initial state (the upload prompt)
    // rather than leaving it pointing at nothing.
    const [settingTableFailed, setSettingTableFailed] = React.useState(false);
    const boundTableName = state.tableName ?? (settingTableFailed ? undefined : (sourceTableName || undefined));
    const boundKind = state.sourceKind ?? DEFAULT_ENGINE_KIND;
    const unbind = (tableName: string, kind: string, why: string) => {
        const label = dsConfig.dataSources.find((d) => d.kind === kind)?.label ?? kind;
        setSource(null);
        setSchema(undefined);
        setRows([]);
        setTotalRows(0);
        // the widget's "table name" setting is only a default: don't retry it either
        setSettingTableFailed(true);
        setState({ tableName: undefined, sourceKind: undefined, filter: undefined });
        // offer the engine it was on, so re-uploading goes to the same place
        const sourceId = dsConfig.dataSources.find((d) => d.kind === kind)?.id;
        if (sourceId) setSelectedSourceId(sourceId);
        alert(
            'Table not available',
            'warning',
            `"${tableName}" isn't loaded in ${label} (boards save which table a widget uses, not its data), so the widget was reset. Upload the file again. (${why})`,
        );
    };
    React.useEffect(() => {
        if (!boundTableName || pushedMode) return;
        let cancelled = false;
        setLoading(true);
        tryBind(boundKind, boundTableName)
            .then((r) => {
                if (cancelled) return;
                if (r.ok) {
                    setSource(r.source);
                    setSchema(r.schema);
                } else {
                    unbind(boundTableName, boundKind, r.why);
                }
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [boundTableName, boundKind]);

    // Stable IDatasource for ag-grid's Infinite Row Model: getRows' startRow/
    // endRow map straight onto DataSource.query's offset/limit, and its
    // sortModel is what drives duckdb's ORDER BY - there is no other sort
    // state in this component. source/filter are read from refs (kept fresh
    // by the effect above) rather than captured here, so this object never
    // needs to change identity; resetting to page 1 after a rebind or a new
    // filter is done explicitly below via setGridOption('datasource', ...).
    const datasource: IDatasource = React.useMemo(() => ({
        getRows: (params: IGetRowsParams) => {
            const src = sourceRef.current;
            if (!src) {
                params.successCallback([], 0);
                return;
            }
            setLoading(true);
            const sort: SortSpec[] = params.sortModel.map((s) => ({
                field: s.colId,
                direction: s.sort as 'asc' | 'desc',
            }));
            src.query({
                filter: filterRef.current,
                sort,
                offset: params.startRow,
                limit: params.endRow - params.startRow,
            })
                .then(async (result) => {
                    const decoded = await resultToRows(result);
                    setTotalRows(result.totalRows);
                    if (result.schema) setSchema(result.schema);
                    // the total goes with every block, so the pager knows the page count up front
                    params.successCallback(decoded, lastRowFor(result.totalRows));
                })
                .catch((e) => {
                    alert('Query failed', 'fail', e instanceof Error ? e.message : String(e));
                    params.failCallback();
                })
                .finally(() => setLoading(false));
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);

    // Reset the grid to row 1 and re-fetch whenever the bound source or
    // filter changes - setGridOption('datasource', ...) is ag-grid's own
    // mechanism for restarting an Infinite Row Model datasource.
    React.useEffect(() => {
        if (pushedMode) return;
        gridApiRef.current?.setGridOption('datasource', datasource);
    }, [source, filter, pushedMode, datasource]);

    const onGridReady = React.useCallback((e: GridReadyEvent) => {
        gridApiRef.current = e.api;
    }, []);

    const onPaginationChanged = React.useCallback((e: PaginationChangedEvent) => {
        const sz = e.api.paginationGetPageSize();
        if (PAGE_SIZE_OPTIONS.includes(sz) && sz !== pageSize) {
            setState({ pageSize: sz });
        }
    }, [pageSize, setState]);

    const applyFilter = React.useCallback((expr: Expression | undefined) => {
        setPushedMode(false);
        setState({ filter: expr });
    }, [setState]);

    const setResult = React.useCallback((result: TablePushedResult) => {
        setLoading(true);
        resultToRows(result)
            .then((decoded) => {
                setPushedMode(true);
                setPushedSource(result.source);
                setRows(decoded);
                setTotalRows(result.totalRows);
                if (result.schema) setSchema(result.schema);
            })
            .catch((e) => alert('Failed to decode pushed result', 'fail', e instanceof Error ? e.message : String(e)))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const releaseResult = React.useCallback(() => {
        setPushedMode(false);
        setPushedSource(undefined);
    }, []);

    const tableExports: TableWidgetExports = {
        tableName: source?.sqlName,
        engine: source ? boundKind : undefined,
        schema,
        source: source ?? undefined,
        applyFilter,
        setResult,
        releaseResult,
    };
    // TableWidgetExports (src/widgets/types.ts) has no index signature, while
    // usePublishExports's WidgetExports param does - cast rather than widen
    // the shared contract type, which Phase 7 is coding against right now.
    usePublishExports(
        wKey,
        tableExports,
        [wKey, source?.id ?? '', boundKind, schema?.name ?? '', applyFilter, setResult, releaseResult],
    );

    const hasConfiguredTables = (selectedSource?.tables.length ?? 0) > 0;
    // undefined for kinds this app has no client for yet (snowflake, rest, ...)
    const selectedEngine = getEngine(selectedSource?.kind);

    const bindTable = () => {
        const name = (hasConfiguredTables ? selectedTable : tableNameInput).trim();
        if (!name) return;
        if (!selectedSource || !selectedEngine) {
            alert(
                'Not supported yet',
                'warning',
                `${selectedSource?.label ?? 'This data source'} isn't wired up to the table widget yet - only DuckDB and qpl are currently supported.`,
            );
            return;
        }
        try {
            sanitizeTableName(name);
        } catch (e) {
            alert('Invalid table name', 'fail', e instanceof Error ? e.message : String(e));
            return;
        }
        setPushedMode(false);
        setState({ tableName: name, sourceKind: selectedEngine.kind, filter: undefined });
        setTableNameInput('');
        setSelectedTable('');
    };

    const uploadExtensionsLabel = (selectedEngine?.uploadExtensions ?? []).map((e) => e.toUpperCase()).join(' / ');

    const handleFile = async (file: File) => {
        if (!selectedEngine) return;
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        const rawName = file.name.replace(/\.[^.]+$/, '');
        const safeName = rawName.replace(/[^A-Za-z0-9_]/g, '_').replace(/^([0-9])/, '_$1') || 'uploaded_table';
        setLoading(true);
        try {
            if (!selectedEngine.uploadExtensions.includes(ext)) {
                throw new Error(
                    `Unsupported file type ".${ext}" for ${selectedSource?.label ?? 'this data source'} - use ${uploadExtensionsLabel}.`,
                );
            }
            const sch = await selectedEngine.ingestFile(file, ext, safeName);
            setPushedMode(false);
            setState({ tableName: sch.name, sourceKind: selectedEngine.kind, filter: undefined });
            alert('Loaded', 'success', `${sch.name}: ${sch.rowCount ?? '?'} rows`);
        } catch (e) {
            alert('Upload failed', 'fail', e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    };

    const tableSettings = useAppSettings((st) => st.table);

    const theme: Theme = React.useMemo(() => {
        const base = themeQuartz.withParams({
            backgroundColor: colors.surface,
            foregroundColor: colors.fore,
            accentColor: colors.info,
            borderColor: colors.border,
            // Header reads as a distinct band rather than melting into row 1.
            headerBackgroundColor: colors.surfaceAlt,
            headerTextColor: colors.foreHalf,
            headerFontWeight: 600,
            headerFontSize: tableSettings.fontSize - 1,
            headerHeight: tableSettings.headerHeight,
            headerColumnBorder: tableSettings.columnBorders,
            headerColumnResizeHandleColor: colors.borderStrong,
            rowHoverColor: colors.infoBarely,
            selectedRowBackgroundColor: colors.infoQuarter,
            oddRowBackgroundColor: tableSettings.stripeRows ? colors.surfaceSubtle : colors.surface,
            rowBorder: true,
            columnBorder: tableSettings.columnBorders,
            wrapperBorder: true,
            wrapperBorderRadius: 8,
            spacing: 6,
            fontSize: tableSettings.fontSize,
            rowHeight: tableSettings.rowHeight,
            cellHorizontalPadding: 14,
            fontFamily: tableSettings.monospaceCells
                ? 'ui-monospace, SFMono-Regular, Menlo, monospace'
                : 'inherit',
            borderRadius: 8,
        });
        return colorMode === 'dark' ? base.withPart(colorSchemeDark) : base;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        colorMode,
        colors.surface, colors.surfaceAlt, colors.surfaceSubtle, colors.fore, colors.foreHalf,
        colors.info, colors.infoBarely, colors.infoQuarter, colors.border, colors.borderStrong,
        tableSettings,
    ]);

    const colDefs = React.useMemo(
        () => (schema ? schemaToColDefs(schema, { serverSort: !pushedMode }) : []),
        [schema, pushedMode],
    );

    const filterSummary = React.useMemo(() => {
        if (!filter || !schema) return null;
        try {
            return toHumanString(filter, schema.fields);
        } catch {
            return 'filter active';
        }
    }, [filter, schema]);

    const showFilterBarResolved = showFilterBar !== false;

    return (
        <Box h="100%" display="flex" flexDirection="column" padding={2} onMouseDown={stopPropagation} onTouchStart={stopPropagation}>
            {!boundTableName && !pushedMode ? (
                <Box borderWidth={1} borderColor={colors.foreQuarter} padding={4} marginBottom={2}>
                    <Text marginBottom={2}>
                        Bind a table from a data source
                        {selectedEngine ? `, or upload a ${uploadExtensionsLabel} file into ${selectedSource?.label}` : ''}.
                    </Text>
                    <HStack marginBottom={2}>
                        <FBSelect
                            typ="info"
                            w="220px"
                            options={dsConfig.dataSources.map((d) => ({ label: d.label, value: d.id }))}
                            value={selectedSourceId}
                            setValue={setSelectedSourceId}
                            isDisabled={isStatic}
                        />
                        {hasConfiguredTables ? (
                            <FBSelect
                                typ="info"
                                options={selectedSource!.tables.map((t) => ({ label: t.label ?? t.name, value: t.name }))}
                                value={selectedTable}
                                setValue={setSelectedTable}
                                isDisabled={isStatic}
                            />
                        ) : (
                            <FBInput
                                typ="info"
                                placeholder="existing table name"
                                value={tableNameInput}
                                setValue={setTableNameInput}
                                isDisabled={isStatic}
                            />
                        )}
                        <FBButton
                            typ="info"
                            onClick={bindTable}
                            isDisabled={isStatic || !(hasConfiguredTables ? selectedTable : tableNameInput).trim()}
                        >
                            Load
                        </FBButton>
                    </HStack>
                    {selectedEngine ? (
                        <>
                            <FBButton
                                typ="success"
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                isDisabled={isStatic}
                            >
                                Upload file…
                            </FBButton>
                            <ChakraFileInput
                                ref={fileInputRef}
                                type="file"
                                accept={selectedEngine.uploadExtensions.map((e) => `.${e}`).join(',')}
                                display="none"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleFile(f);
                                    e.target.value = '';
                                }}
                            />
                        </>
                    ) : null}
                </Box>
            ) : null}

            {(boundTableName || pushedMode) && showFilterBarResolved ? (
                <HStack marginBottom={2} spacing={3} wrap="wrap">
                    <Text fontSize="sm" color={colors.foreHalf}>
                        {boundTableName ?? 'query result'}
                        {boundTableName && boundKind !== DEFAULT_ENGINE_KIND ? ` (${boundKind})` : ''}
                    </Text>
                    <ConnectionBadge connected={!!linkedEditor} label={linkedEditor?.name} />
                    <FBButton
                        typ="info"
                        variant="outline"
                        size="sm"
                        onClick={() => setFilterOpen(true)}
                        isDisabled={isStatic || !schema || pushedMode || source?.supportsFilter === false}
                    >
                        Filter
                    </FBButton>
                    {filterSummary ? (
                        <HStack spacing={1}>
                            <Text fontSize="sm" color={colors.info} noOfLines={1} maxW="360px">{filterSummary}</Text>
                            <FBButton
                                typ="fail"
                                variant="outline"
                                size="xs"
                                onClick={() => applyFilter(undefined)}
                                isDisabled={isStatic}
                            >
                                ×
                            </FBButton>
                        </HStack>
                    ) : null}
                    <Box flex={1} />
                    {pushedMode ? (
                        <HStack spacing={2}>
                            <Text fontSize="sm" color={colors.foreHalf}>
                                {totalRows} rows{pushedSource ? ` — filtered by ${pushedSource.name}` : ' (query result)'}
                            </Text>
                            <FBButton
                                typ="warning"
                                variant="outline"
                                size="xs"
                                onClick={releaseResult}
                                isDisabled={isStatic}
                            >
                                Unlink
                            </FBButton>
                        </HStack>
                    ) : null}
                </HStack>
            ) : null}

            <Box flex={1} minH={0} position="relative">
                {loading ? (
                    <Center position="absolute" top={0} left={0} right={0} bottom={0} zIndex={1} bg={colors.bgHalf}>
                        <Spinner color={colors.info} />
                    </Center>
                ) : null}
                {schema ? (
                    <AgGridReact
                        // rowModelType is only read at grid creation, so a
                        // key forces a clean remount on the (infrequent)
                        // transition between a bound table and a pushed
                        // query result rather than leaving a stale grid.
                        key={pushedMode ? 'pushed' : 'bound'}
                        theme={theme}
                        columnDefs={colDefs}
                        onGridReady={onGridReady}
                        onPaginationChanged={onPaginationChanged}
                        animateRows={false}
                        {...(pushedMode
                            ? { rowData: rows, pagination: false }
                            : {
                                rowModelType: 'infinite' as const,
                                datasource,
                                pagination: true,
                                paginationPageSize: pageSize,
                                paginationPageSizeSelector: PAGE_SIZE_OPTIONS,
                            })}
                    />
                ) : (
                    <Center h="100%">
                        <Text color={colors.foreHalf}>No data source bound yet.</Text>
                    </Center>
                )}
            </Box>

            {schema ? (
                <ExpressionBuilder
                    isOpen={filterOpen}
                    onClose={() => setFilterOpen(false)}
                    fields={schema.fields}
                    initialExpression={filter}
                    onApply={(expr) => applyFilter(expr)}
                    getCategories={source?.getCategories ? (f: string) => source.getCategories!(f) : undefined}
                    isStatic={isStatic}
                />
            ) : null}
        </Box>
    );
};

export default TableWidget;
