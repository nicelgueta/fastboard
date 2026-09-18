import React from 'react';
import { Box, HStack, Text, Input as ChakraFileInput, Center, Spinner } from '@chakra-ui/react';
import { AgGridReact } from 'ag-grid-react';
import {
    ModuleRegistry,
    AllCommunityModule,
    themeQuartz,
    colorSchemeDark,
    type Theme,
} from 'ag-grid-community';
import { useColorMode } from '@chakra-ui/color-mode';
import useAppColors from '../../hooks/useAppColors';
import { stopPropagation } from '../../components/common';
import useUserAlert from '../../hooks/useUserAlert';
import { useWidgetState, usePublishExports } from '../../store/hooks';
import { WidgetElementProps } from '../../interfaces';
import type { TableWidgetExports } from '../types';
import type { DataSource, Expression, FieldDef, FieldType, TableSchema } from '../../data/types';
import { resultToRows } from '../../data/decode';
import { DuckDbDataSource } from '../../data/duckdb/DuckDbDataSource';
import { registerCsv, registerJson, registerParquet, sanitizeTableName } from '../../data/duckdb/ingest';
import { toHumanString } from '../../data/expression';
import FBButton from '../../components/primitive/Button';
import FBInput from '../../components/primitive/Input';
import FBSelect from '../../components/primitive/Select';
import ExpressionBuilder from './ExpressionBuilder';
import { schemaToColDefs } from './colDefs';

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
    filter?: Expression;
    pageSize?: number;
    page?: number;
    // Set when the SQL editor (Phase 7) pushed a result via setResult -
    // that result bypasses the bound DataSource / server pagination.
    pushedSchema?: TableSchema;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500];

/**
 * Client-side row model (ag-grid Community) held one page of rows at a
 * time, fetched from DataSource.query with limit/offset - rather than
 * loading a whole (possibly huge) result set into the browser and letting
 * ag-grid's own pagination slice it. This keeps memory bounded and matches
 * the paged QueryRequest/QueryResult contract in src/data/types.ts. Own
 * prev/next + page-size controls drive it; ag-grid's built-in pagination UI
 * is left off (`pagination={false}`).
 */
const TableWidget: React.FC<TableWidgetProps> = (props) => {
    const { wKey, isStatic, defaultPageSize, sourceTableName, showFilterBar } = props;
    const [colors] = useAppColors();
    const { colorMode } = useColorMode();
    const alert = useUserAlert();
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const [state, setState] = useWidgetState<TablePersistedState>(wKey);

    const initialPageSize = React.useMemo(() => {
        const n = Number(defaultPageSize);
        return PAGE_SIZE_OPTIONS.includes(n) ? n : 25;
    }, [defaultPageSize]);

    const pageSize = state.pageSize ?? initialPageSize;
    const page = state.page ?? 0;
    const filter = state.filter;

    const [source, setSource] = React.useState<DataSource | null>(null);
    const [schema, setSchema] = React.useState<TableSchema | undefined>(undefined);
    const [rows, setRows] = React.useState<Record<string, unknown>[]>([]);
    const [totalRows, setTotalRows] = React.useState(0);
    const [loading, setLoading] = React.useState(false);
    const [tableNameInput, setTableNameInput] = React.useState('');
    const [filterOpen, setFilterOpen] = React.useState(false);
    // A result pushed externally (e.g. by the SQL editor via setResult) is
    // shown as-is: it has already been limited/offset by whoever produced
    // it, so our own pager is not meaningful against it.
    const [pushedMode, setPushedMode] = React.useState(false);

    // Bind (or rebind) the DuckDbDataSource whenever the persisted table
    // name changes - including on mount when restoring from a saved board.
    const boundTableName = state.tableName ?? (sourceTableName || undefined);
    React.useEffect(() => {
        if (!boundTableName || pushedMode) return;
        let cancelled = false;
        setLoading(true);
        try {
            const ds = new DuckDbDataSource(boundTableName);
            ds.getSchema()
                .then((sch) => {
                    if (cancelled) return;
                    setSource(ds);
                    setSchema(sch);
                })
                .catch((e) => {
                    if (cancelled) return;
                    alert('Failed to bind table', 'fail', e instanceof Error ? e.message : String(e));
                })
                .finally(() => { if (!cancelled) setLoading(false); });
        } catch (e) {
            setLoading(false);
            alert('Invalid table name', 'fail', e instanceof Error ? e.message : String(e));
        }
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [boundTableName]);

    // Fetch the current page whenever source/filter/page/pageSize changes.
    const fetchPage = React.useCallback(async () => {
        if (!source || !schema || pushedMode) return;
        setLoading(true);
        try {
            const result = await source.query({
                filter,
                offset: page * pageSize,
                limit: pageSize,
            });
            const decoded = await resultToRows(result);
            setRows(decoded);
            setTotalRows(result.totalRows);
            if (result.schema) setSchema(result.schema);
        } catch (e) {
            alert('Query failed', 'fail', e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [source, schema?.name, filter, page, pageSize, pushedMode]);

    React.useEffect(() => {
        fetchPage();
    }, [fetchPage]);

    const clampPage = (nextTotal: number, sz: number, p: number) => {
        const maxPage = Math.max(0, Math.ceil(nextTotal / sz) - 1);
        return Math.min(p, maxPage);
    };

    const applyFilter = React.useCallback((expr: Expression | undefined) => {
        setPushedMode(false);
        setState({ filter: expr, page: 0 });
    }, [setState]);

    const setResult = React.useCallback((result: { bytes: Uint8Array; format: 'arrow-ipc' | 'parquet'; totalRows: number; schema?: TableSchema }) => {
        setLoading(true);
        resultToRows(result)
            .then((decoded) => {
                setPushedMode(true);
                setRows(decoded);
                setTotalRows(result.totalRows);
                if (result.schema) setSchema(result.schema);
                setState({ page: 0 });
            })
            .catch((e) => alert('Failed to decode pushed result', 'fail', e instanceof Error ? e.message : String(e)))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const tableExports: TableWidgetExports = {
        tableName: source?.sqlName,
        schema,
        source: source ?? undefined,
        applyFilter,
        setResult,
    };
    // TableWidgetExports (src/widgets/types.ts) has no index signature, while
    // usePublishExports's WidgetExports param does - cast rather than widen
    // the shared contract type, which Phase 7 is coding against right now.
    usePublishExports(
        wKey,
        tableExports,
        [wKey, source?.id ?? '', schema?.name ?? '', applyFilter, setResult],
    );

    const bindTable = () => {
        const name = tableNameInput.trim();
        if (!name) return;
        try {
            sanitizeTableName(name);
        } catch (e) {
            alert('Invalid table name', 'fail', e instanceof Error ? e.message : String(e));
            return;
        }
        setPushedMode(false);
        setState({ tableName: name, filter: undefined, page: 0 });
        setTableNameInput('');
    };

    const handleFile = async (file: File) => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        const rawName = file.name.replace(/\.[^.]+$/, '');
        const safeName = rawName.replace(/[^A-Za-z0-9_]/g, '_').replace(/^([0-9])/, '_$1') || 'uploaded_table';
        setLoading(true);
        try {
            let sch: TableSchema;
            if (ext === 'csv') sch = await registerCsv(file, safeName);
            else if (ext === 'json') sch = await registerJson(file, safeName);
            else if (ext === 'parquet') sch = await registerParquet(file, safeName);
            else throw new Error(`Unsupported file type ".${ext}" - use CSV, JSON or Parquet.`);
            setPushedMode(false);
            setState({ tableName: sch.name, filter: undefined, page: 0 });
            alert('Loaded', 'success', `${sch.name}: ${sch.rowCount ?? '?'} rows`);
        } catch (e) {
            alert('Upload failed', 'fail', e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    };

    const theme: Theme = React.useMemo(() => {
        const base = themeQuartz.withParams({
            backgroundColor: colors.bg,
            foregroundColor: colors.fore,
            accentColor: colors.info,
            borderColor: colors.foreQuarter,
            headerBackgroundColor: colors.bgQuarter,
            headerTextColor: colors.fore,
            rowHoverColor: colors.infoBarely,
            oddRowBackgroundColor: colors.bgQuarter,
            fontFamily: 'courier new',
        });
        return colorMode === 'dark' ? base.withPart(colorSchemeDark) : base;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [colorMode, colors.bg, colors.fore, colors.info, colors.foreQuarter, colors.bgQuarter, colors.infoBarely]);

    const colDefs = React.useMemo(() => (schema ? schemaToColDefs(schema) : []), [schema]);

    const filterSummary = React.useMemo(() => {
        if (!filter || !schema) return null;
        try {
            return toHumanString(filter, schema.fields);
        } catch {
            return 'filter active';
        }
    }, [filter, schema]);

    const maxPage = pushedMode ? 0 : Math.max(0, Math.ceil(totalRows / pageSize) - 1);
    const showFilterBarResolved = showFilterBar !== false;

    return (
        <Box h="100%" display="flex" flexDirection="column" padding={2} onMouseDown={stopPropagation} onTouchStart={stopPropagation}>
            {!boundTableName && !pushedMode ? (
                <Box borderWidth={1} borderColor={colors.foreQuarter} padding={4} marginBottom={2}>
                    <Text marginBottom={2}>Bind an existing duckdb table, or upload a CSV / JSON / Parquet file.</Text>
                    <HStack marginBottom={2}>
                        <FBInput
                            typ="info"
                            placeholder="existing table name"
                            value={tableNameInput}
                            setValue={setTableNameInput}
                            isDisabled={isStatic}
                        />
                        <FBButton typ="info" onClick={bindTable} isDisabled={isStatic || !tableNameInput.trim()}>Load</FBButton>
                    </HStack>
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
                        accept=".csv,.json,.parquet"
                        display="none"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleFile(f);
                            e.target.value = '';
                        }}
                    />
                </Box>
            ) : null}

            {(boundTableName || pushedMode) && showFilterBarResolved ? (
                <HStack marginBottom={2} spacing={3} wrap="wrap">
                    <Text fontSize="sm" color={colors.foreHalf}>
                        {boundTableName ?? 'query result'}
                    </Text>
                    <FBButton
                        typ="info"
                        variant="outline"
                        size="sm"
                        onClick={() => setFilterOpen(true)}
                        isDisabled={isStatic || !schema || pushedMode}
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
                    {!pushedMode ? (
                        <>
                            <FBSelect
                                typ="info"
                                w="90px"
                                options={PAGE_SIZE_OPTIONS.map((n) => ({ label: String(n), value: n }))}
                                value={pageSize}
                                setValue={(v: string) => {
                                    const sz = Number(v);
                                    setState({ pageSize: sz, page: clampPage(totalRows, sz, page) });
                                }}
                            />
                            <FBButton
                                typ="info"
                                variant="outline"
                                size="sm"
                                isDisabled={page <= 0}
                                onClick={() => setState({ page: Math.max(0, page - 1) })}
                            >
                                ‹
                            </FBButton>
                            <Text fontSize="sm">
                                {totalRows === 0 ? '0 rows' : `${page * pageSize + 1}–${Math.min(totalRows, (page + 1) * pageSize)} of ${totalRows}`}
                            </Text>
                            <FBButton
                                typ="info"
                                variant="outline"
                                size="sm"
                                isDisabled={page >= maxPage}
                                onClick={() => setState({ page: Math.min(maxPage, page + 1) })}
                            >
                                ›
                            </FBButton>
                        </>
                    ) : (
                        <Text fontSize="sm" color={colors.foreHalf}>{totalRows} rows (query result)</Text>
                    )}
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
                        theme={theme}
                        columnDefs={colDefs}
                        rowData={rows}
                        pagination={false}
                        animateRows={false}
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
