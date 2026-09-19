import React from 'react';
import { Box, HStack, Text, VStack, Center, Spinner, Input, Select, Badge } from '@chakra-ui/react';
import ForceGraph3D, { type ForceGraphMethods, type NodeObject, type LinkObject } from 'react-force-graph-3d';
import type { Object3D } from 'three';
import SpriteText from 'three-spritetext';
import useAppColors, { RADIUS } from '../../hooks/useAppColors';
import { stopPropagation } from '../../components/common';
import FBButton from '../../components/primitive/Button';
import { WidgetElementProps } from '../../interfaces';
import { useWidgetState, usePublishExports } from '../../store/hooks';
import { useWidgetStore } from '../../store/widgetStore';
import type { GraphWidgetExports } from '../types';
import type { CatalogGraph, CatalogNode, CatalogSource } from './catalog';
import { DuckDbCatalogSource } from './DuckDbCatalogSource';
import { GRAPH_DEPTH_OPTIONS } from './config';
import { mixCss, toHex } from '../../utils/color';
import {
  NODE_WARN_THRESHOLD,
  TYPE_GROUP_LABELS,
  type TypeGroup,
  computeDegrees,
  countByKind,
  escapeHtml,
  limitDepth,
  matchNodes,
  mergeGraphs,
  neighborIds,
  shouldLabel,
  typeGroup,
} from './graphModel';

interface GraphWidgetProps extends WidgetElementProps {
  defaultDepth?: number | string;
}

interface GraphPersistedState {
  depth?: number;
  /** Text labels on the nodes. Absent means on. */
  labels?: boolean;
}

const EMPTY_GRAPH: CatalogGraph = { nodes: [], links: [] };
const DOUBLE_CLICK_MS = 350;
const FOCUS_DISTANCE = 70;

type GNode = NodeObject<CatalogNode>;
type GLink = LinkObject<CatalogNode, { relation: string }>;

const endId = (end: unknown): string =>
  typeof end === 'object' && end !== null ? String((end as { id: string }).id) : String(end);

/** Size of an element's content box, kept live as a dockview panel is resized. */
function useElementSize<T extends HTMLElement>(ref: React.RefObject<T>): { width: number; height: number } {
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (w: number, h: number) =>
      setSize((s) => (Math.round(s.width) === Math.round(w) && Math.round(s.height) === Math.round(h) ? s : { width: w, height: h }));
    const rect = el.getBoundingClientRect();
    measure(rect.width, rect.height);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) measure(r.width, r.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/**
 * 3D explorer for a data catalog: databases, schemas, tables and columns as
 * nodes, "contains" as links. Written against CatalogSource so another catalog
 * can be plugged in; the duckdb one is the reference implementation.
 *
 * react-force-graph-3d owns its own three.js scene and (unlike the landing
 * page's R3F canvas) does not auto-size, so the container is measured here and
 * width/height passed down. The lib mutates the node/link objects it is given
 * (adds x/y/z, swaps link ids for node refs), so it always gets fresh copies.
 */
const GraphWidget: React.FC<GraphWidgetProps> = ({ wKey, isStatic, defaultDepth }) => {
  const [colors] = useAppColors();
  const [state, setState] = useWidgetState<GraphPersistedState>(wKey);

  const source: CatalogSource = React.useMemo(() => new DuckDbCatalogSource(), []);
  const [graph, setGraph] = React.useState<CatalogGraph>(EMPTY_GRAPH);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = React.useState('');
  const [reloadTick, setReloadTick] = React.useState(0);

  const configuredDepth = Number(defaultDepth);
  const depth = state.depth ?? (Number.isInteger(configuredDepth) ? configuredDepth : 3);
  const showLabels = state.labels ?? true;

  const [query, setQuery] = React.useState('');
  const [selectedId, setSelectedId] = React.useState<string | undefined>(undefined);
  const [confirmedBig, setConfirmedBig] = React.useState(false);

  // Reload whenever a table widget binds a different table (its export changes
  // when a file is ingested), plus on demand from the Refresh button.
  const tablesKey = useWidgetStore((s) =>
    Object.values(s.widgets)
      .filter((w) => w.type === 'table')
      .map((w) => String((s.exports[w.wKey] as { tableName?: string } | undefined)?.tableName ?? ''))
      .sort()
      .join('|'),
  );

  React.useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    source
      .getGraph()
      .then((g) => {
        if (cancelled) return;
        setGraph(g);
        setStatus('ready');
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, [source, tablesKey, reloadTick]);

  const visible = React.useMemo(() => limitDepth(graph, depth), [graph, depth]);
  const degrees = React.useMemo(() => computeDegrees(visible), [visible]);
  const nodeById = React.useMemo(() => new Map(visible.nodes.map((n) => [n.id, n])), [visible]);
  const matches = React.useMemo(() => matchNodes(visible.nodes, query), [visible, query]);
  const searching = query.trim() !== '';
  const counts = React.useMemo(() => countByKind(visible), [visible]);
  const typeCounts = React.useMemo(() => {
    const out: Partial<Record<TypeGroup, number>> = {};
    for (const n of visible.nodes) {
      if (n.kind !== 'column') continue;
      const g = typeGroup(n.meta?.type);
      out[g] = (out[g] ?? 0) + 1;
    }
    return out;
  }, [visible]);
  const oversize = visible.nodes.length > NODE_WARN_THRESHOLD;
  const hasTables = React.useMemo(() => graph.nodes.some((n) => n.kind === 'table'), [graph]);

  // a new dataset or depth is a new question for the "draw it anyway?" prompt
  React.useEffect(() => { setConfirmedBig(false); }, [visible]);
  // a selection that the depth cap or a reload removed is no longer a selection
  React.useEffect(() => {
    if (selectedId && !nodeById.has(selectedId)) setSelectedId(undefined);
  }, [nodeById, selectedId]);

  const graphData = React.useMemo(
    () => ({
      nodes: visible.nodes.map((n) => ({ ...n })),
      links: visible.links.map((l) => ({ ...l })),
    }),
    [visible],
  );

  const selected = selectedId ? nodeById.get(selectedId) : undefined;
  const selectedNeighbors = React.useMemo(
    () => (selectedId ? neighborIds(visible, selectedId) : new Set<string>()),
    [visible, selectedId],
  );

  const exportsObj = React.useMemo<GraphWidgetExports>(
    () => ({
      selectedNodeId: selected?.id,
      selectedNode: selected && { id: selected.id, label: selected.label, kind: selected.kind, meta: selected.meta },
    }),
    [selected],
  );
  usePublishExports(wKey, exportsObj, [exportsObj]);

  // --- rendering ----------------------------------------------------------
  const bgHex = toHex(colors.bg);
  // Structure (database / schema / table) is drawn in the accent and neutral tones; the
  // semantic hues are kept for column data types, so a column's colour reads as its type.
  const kindColor = React.useCallback(
    (kind: string): string => {
      switch (kind) {
        case 'database': return colors.info;
        case 'schema': return colors.infoLight;
        case 'table': return colors.fore;
        default: return colors.foreHalf;
      }
    },
    [colors],
  );
  const typeColor = React.useCallback(
    (group: TypeGroup): string => {
      switch (group) {
        case 'text': return colors.success;
        case 'numeric': return colors.warning;
        case 'boolean': return colors.fail;
        case 'temporal': return mixCss(colors.fail, colors.info, 0.5);
        case 'nested': return mixCss(colors.success, colors.warning, 0.5);
        default: return mixCss(colors.fore, colors.bg, 0.5);
      }
    },
    [colors],
  );
  const baseColor = React.useCallback(
    (n: { kind?: unknown; meta?: Record<string, unknown> }): string =>
      n.kind === 'column' ? typeColor(typeGroup(n.meta?.type)) : kindColor(String(n.kind)),
    [kindColor, typeColor],
  );

  const nodeColor = React.useCallback(
    (n: GNode) => {
      const base = toHex(baseColor(n));
      return searching && !matches.has(String(n.id)) && n.id !== selectedId ? mixCss(base, bgHex, 0.82) : base;
    },
    [selectedId, baseColor, searching, matches, bgHex],
  );
  const linkColor = React.useCallback(
    (l: GLink) => {
      const s = endId(l.source);
      const t = endId(l.target);
      if (selectedId && (s === selectedId || t === selectedId)) return toHex(colors.info);
      const dimmed = searching && !(matches.has(s) && matches.has(t));
      return mixCss(colors.fore, bgHex, dimmed ? 0.93 : 0.72);
    },
    [selectedId, colors, searching, matches, bgHex],
  );
  const nodeVal = React.useCallback(
    (n: GNode) => (1 + Math.sqrt(degrees.get(String(n.id)) ?? 0) * 2) * (n.id === selectedId ? 2.2 : 1),
    [degrees, selectedId],
  );
  const nodeLabel = React.useCallback(
    (n: GNode) =>
      `<div style="padding:4px 8px;border-radius:${RADIUS.sm};font-family:system-ui;font-size:12px;` +
      `background:${toHex(colors.surfaceAlt)};color:${toHex(colors.fore)};border:1px solid ${toHex(colors.borderStrong)}">` +
      `<span style="opacity:.6">${escapeHtml(String(n.kind))}</span> ${escapeHtml(String(n.label))}</div>`,
    [colors],
  );

  // Text labels as sprites floating above each node. Sprites own a canvas texture, so they are
  // cached per node+colour (a selection or search change re-runs the accessor for every node)
  // and disposed when the graph is replaced.
  const spriteCache = React.useRef(new Map<string, SpriteText>());
  React.useEffect(() => {
    const cache = spriteCache.current;
    return () => {
      cache.forEach((sp) => { sp.material.map?.dispose(); sp.material.dispose(); });
      cache.clear();
    };
  }, [graphData]);
  const labelCtx = React.useMemo(
    () => ({
      total: visible.nodes.length,
      structural: visible.nodes.length - (counts.column ?? 0),
      selectedId,
      neighbors: selectedNeighbors,
      matches,
      searching,
    }),
    [visible, counts, selectedId, selectedNeighbors, matches, searching],
  );
  const nodeThreeObject = React.useCallback(
    (n: GNode): Object3D => {
      const id = String(n.id);
      if (!showLabels || !shouldLabel(String(n.kind), id, labelCtx)) return null as unknown as Object3D;
      const isColumn = n.kind === 'column';
      const color = toHex(colors.fore);
      const key = `${id}|${color}|${bgHex}`;
      let sprite = spriteCache.current.get(key);
      if (!sprite) {
        sprite = new SpriteText(String(n.label), isColumn ? 2.6 : 4, color);
        sprite.strokeWidth = 1.2;
        sprite.strokeColor = bgHex;
        sprite.fontWeight = isColumn ? '400' : '600';
        sprite.material.depthWrite = false;
        // sit just above the sphere (radius = nodeRelSize(4) * cbrt(val))
        sprite.position.y = 4 * Math.cbrt(nodeVal(n)) + sprite.textHeight * 0.75;
        spriteCache.current.set(key, sprite);
      }
      return sprite;
    },
    [showLabels, labelCtx, colors, bgHex, nodeVal],
  );

  const fgRef = React.useRef<ForceGraphMethods<GNode, GLink> | undefined>(undefined);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(stageRef);
  const fitted = React.useRef(false);
  React.useEffect(() => { fitted.current = false; }, [graphData]);

  const focusNode = React.useCallback((node: { x?: number; y?: number; z?: number }) => {
    const fg = fgRef.current;
    if (!fg) return;
    const { x = 0, y = 0, z = 0 } = node;
    const len = Math.hypot(x, y, z);
    const position = len === 0
      ? { x: 0, y: 0, z: FOCUS_DISTANCE }
      : { x: x * (1 + FOCUS_DISTANCE / len), y: y * (1 + FOCUS_DISTANCE / len), z: z * (1 + FOCUS_DISTANCE / len) };
    fg.cameraPosition(position, { x, y, z }, 900);
  }, []);

  const liveNode = React.useCallback(
    (id: string): GNode | undefined => (graphData.nodes as GNode[]).find((n) => n.id === id),
    [graphData],
  );

  const expandNode = React.useCallback(
    async (node: GNode) => {
      if (!source.expand) {
        focusNode(node);
        return;
      }
      try {
        const extra = await source.expand(String(node.id));
        setGraph((g) => mergeGraphs(g, extra));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      }
    },
    [source, focusNode],
  );

  // 3d-force-graph has no double-click event: two clicks on one node inside the window is one.
  const lastClick = React.useRef<{ id: string; at: number }>({ id: '', at: 0 });
  const onNodeClick = React.useCallback(
    (node: GNode) => {
      const id = String(node.id);
      const now = Date.now();
      if (lastClick.current.id === id && now - lastClick.current.at < DOUBLE_CLICK_MS) {
        lastClick.current = { id: '', at: 0 };
        void expandNode(node);
        return;
      }
      lastClick.current = { id, at: now };
      setSelectedId(id);
    },
    [expandNode],
  );
  const onNodeRightClick = React.useCallback(
    (node: GNode, event: MouseEvent) => {
      event.preventDefault();
      setSelectedId(String(node.id));
      focusNode(node);
    },
    [focusNode],
  );

  const selectControls = {
    size: 'sm' as const,
    borderRadius: RADIUS.md,
    borderColor: colors.infoHalf,
    color: colors.fore,
    bg: colors.surface,
    _hover: { borderColor: colors.info },
  };

  const overlayBox = {
    bg: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADIUS.lg,
    p: 3,
  };

  return (
    <Box h="100%" display="flex" flexDirection="column" onMouseDown={stopPropagation} onTouchStart={stopPropagation}>
      <HStack spacing={2} p={2} wrap="wrap" borderBottomWidth={1} borderColor={colors.border} bg={colors.surface}>
        <Input
          {...selectControls}
          w="200px"
          placeholder="Search nodes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search nodes"
        />
        <Select
          {...selectControls}
          w="170px"
          value={depth}
          onChange={(e) => setState({ depth: Number(e.target.value) })}
          aria-label="Depth"
          isDisabled={isStatic}
        >
          {GRAPH_DEPTH_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
        <FBButton
          typ="info"
          variant={showLabels ? 'solid' : 'outline'}
          size="sm"
          onClick={() => setState({ labels: !showLabels })}
          aria-pressed={showLabels}
        >
          Labels
        </FBButton>
        <FBButton typ="info" variant="outline" size="sm" onClick={() => fgRef.current?.zoomToFit(500, 60)}>
          Fit
        </FBButton>
        <FBButton typ="info" variant="outline" size="sm" onClick={() => setReloadTick((n) => n + 1)}>
          Refresh
        </FBButton>
        <Box flex={1} />
        <Text fontSize="xs" color={colors.foreHalf}>
          {status === 'loading' ? 'Loading…' : (
            <>
              {visible.nodes.length} nodes
              {searching ? ` · ${matches.size} match${matches.size === 1 ? '' : 'es'}` : ''}
            </>
          )}
        </Text>
      </HStack>

      <Box ref={stageRef} flex={1} minH={0} position="relative" overflow="hidden" bg={colors.bg}>
        {status !== 'error' && width > 0 && height > 0 && (!oversize || confirmedBig) ? (
          <ForceGraph3D
            ref={fgRef}
            width={width}
            height={height}
            graphData={graphData}
            backgroundColor={bgHex}
            showNavInfo={false}
            nodeColor={nodeColor}
            nodeVal={nodeVal}
            nodeLabel={nodeLabel}
            nodeThreeObject={nodeThreeObject}
            nodeThreeObjectExtend
            nodeOpacity={0.95}
            nodeResolution={12}
            linkColor={linkColor}
            linkOpacity={0.7}
            linkWidth={(l: GLink) => {
              const s = endId(l.source);
              const t = endId(l.target);
              return selectedId && (s === selectedId || t === selectedId) ? 1.5 : 0;
            }}
            linkLabel={(l: GLink) => escapeHtml(String(l.relation))}
            enableNodeDrag={!isStatic}
            cooldownTime={visible.nodes.length > 1500 ? 5000 : 15000}
            onNodeClick={onNodeClick}
            onNodeRightClick={onNodeRightClick}
            onBackgroundClick={() => setSelectedId(undefined)}
            onEngineStop={() => {
              if (fitted.current) return;
              fitted.current = true;
              fgRef.current?.zoomToFit(400, 60);
            }}
          />
        ) : null}

        {status === 'loading' && graph.nodes.length === 0 ? (
          <Center position="absolute" inset={0} pointerEvents="none">
            <Spinner color={colors.info} />
          </Center>
        ) : null}

        {status === 'error' ? (
          <Center position="absolute" inset={0} p={6}>
            <VStack {...overlayBox} spacing={2} maxW="420px" align="flex-start">
              <Text fontWeight="bold" color={colors.fail}>Could not read the catalog</Text>
              <Text fontSize="sm" color={colors.fore}>{error}</Text>
              <FBButton typ="info" size="sm" onClick={() => setReloadTick((n) => n + 1)}>Retry</FBButton>
            </VStack>
          </Center>
        ) : null}

        {status === 'ready' && !hasTables ? (
          <Center position="absolute" inset={0} p={6} pointerEvents="none">
            <Text fontSize="sm" color={colors.foreHalf} textAlign="center" maxW="360px">
              No tables loaded yet. Upload a CSV, JSON or Parquet file into a Data Table widget
              (DuckDB source) and its table will appear here.
            </Text>
          </Center>
        ) : null}

        {status !== 'error' && oversize && !confirmedBig ? (
          <Center position="absolute" inset={0} p={6}>
            <VStack {...overlayBox} spacing={3} maxW="420px" align="flex-start">
              <Text fontWeight="bold" color={colors.warning}>
                {visible.nodes.length.toLocaleString()} nodes at this depth
              </Text>
              <Text fontSize="sm" color={colors.fore}>
                A 3D force layout this size can be very slow. Reduce the depth, or draw it anyway.
              </Text>
              <HStack>
                <FBButton typ="info" size="sm" onClick={() => setState({ depth: Math.max(0, depth - 1) })} isDisabled={depth === 0 || isStatic}>
                  Show one level less
                </FBButton>
                <FBButton typ="warning" variant="outline" size="sm" onClick={() => setConfirmedBig(true)}>
                  Draw anyway
                </FBButton>
              </HStack>
            </VStack>
          </Center>
        ) : null}

        <VStack position="absolute" left={2} bottom={2} align="flex-start" spacing={1} pointerEvents="none" fontSize="xs" color={colors.foreHalf}>
          <HStack spacing={3} wrap="wrap">
            {(['database', 'schema', 'table'] as const).map((k) => (
              counts[k] ? (
                <HStack key={k} spacing={1}>
                  <Box w="8px" h="8px" borderRadius="full" bg={kindColor(k)} />
                  <Text>{k} {counts[k]}</Text>
                </HStack>
              ) : null
            ))}
          </HStack>
          {counts.column ? (
            <HStack spacing={3} wrap="wrap">
              <Text>columns by type:</Text>
              {(Object.keys(TYPE_GROUP_LABELS) as TypeGroup[]).map((g) => (
                typeCounts[g] ? (
                  <HStack key={g} spacing={1}>
                    <Box w="8px" h="8px" borderRadius="full" bg={typeColor(g)} />
                    <Text>{TYPE_GROUP_LABELS[g]} {typeCounts[g]}</Text>
                  </HStack>
                ) : null
              ))}
            </HStack>
          ) : null}
        </VStack>

        {selected ? (
          <VStack
            {...overlayBox}
            position="absolute"
            top={2}
            right={2}
            w="240px"
            maxH="calc(100% - 16px)"
            overflowY="auto"
            align="stretch"
            spacing={2}
            data-testid="graph-detail"
          >
            <HStack justify="space-between" align="flex-start">
              <VStack align="flex-start" spacing={0} minW={0}>
                <Badge bg={colors.infoQuarter} color={colors.fore} fontSize="10px">{selected.kind}</Badge>
                <Text fontWeight="bold" color={colors.fore} wordBreak="break-all">{selected.label}</Text>
              </VStack>
              <FBButton typ="info" variant="outline" size="xs" onClick={() => setSelectedId(undefined)}>×</FBButton>
            </HStack>
            {Object.entries(selected.meta ?? {}).map(([k, v]) => (
              <HStack key={k} align="flex-start" justify="space-between" fontSize="xs">
                <Text color={colors.foreHalf}>{k}</Text>
                <Text color={colors.fore} textAlign="right" wordBreak="break-all">{String(v)}</Text>
              </HStack>
            ))}
            <HStack justify="space-between" fontSize="xs">
              <Text color={colors.foreHalf}>connected nodes</Text>
              <Text color={colors.fore}>{selectedNeighbors.size}</Text>
            </HStack>
            <FBButton
              typ="info"
              size="xs"
              onClick={() => {
                const live = liveNode(selected.id);
                if (live) focusNode(live);
              }}
            >
              Focus camera
            </FBButton>
          </VStack>
        ) : null}
      </Box>
    </Box>
  );
};

export default GraphWidget;
