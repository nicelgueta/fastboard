import React from 'react';
import { Box, Flex, Select, Button, Text, Spinner } from '@chakra-ui/react';
import { FaPlay } from 'react-icons/fa';
import { useColorMode } from '@chakra-ui/color-mode';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import debounce from 'lodash/debounce';

import { WidgetElementProps } from '../../interfaces';
import { stopPropagation } from '../../components/common';
import useAppColors from '../../hooks/useAppColors';
import useUserAlert from '../../hooks/useUserAlert';
import { useWidgetState, useWidgetsByType, useWidgetExports, usePublishExports, useEditorLinks } from '../../store/hooks';
import { useWidgetStore, WidgetExports } from '../../store/widgetStore';
import { useShallow } from 'zustand/react/shallow';
import type { TableWidgetExports, EditorWidgetExports } from '../types';
import ConnectionBadge from '../ConnectionBadge';

import './monaco-setup';
import { registerSqlCompletions, tableWidgetsToCompletionSources, CompletionSource } from './sqlCompletions';
import { runSqlAgainstTarget } from './runSql';
import { runQplAgainstTarget, QplRunError } from './runQpl';
import EditorOutput from './EditorOutput';
import { clampSize, defaultSize, dockComesFirst, isSideDock, normalizeDock, sizeFromPointer, type Dock } from './dock';
import { appendEntry, makeEntry, type OutputEntry, type RunResult } from './outputLog';
import { ensureQplLanguage } from './qplLanguage';
import { isRunnableLanguage, languageForEngine } from './runLanguage';
import { EDITOR_LANGUAGES } from './config';
import { RUN_SHORTCUT_LABEL, runLabelMode } from './runButton';
import useElementWidth from '../../hooks/useElementWidth';

// Languages Monaco's basic-languages bundle (loaded as part of the
// `monaco-editor` package's default entry) ships highlighting for.
export type EditorLanguage =
  | 'sql'
  | 'qpl'
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'json'
  | 'yaml'
  | 'markdown'
  | 'shell';

const DEFAULT_SNIPPETS: Partial<Record<EditorLanguage, string>> = {
  sql: '-- SELECT * FROM my_table WHERE x > 5\n',
  qpl: '/ select from my_table where x > 5\n',
};

interface EditorWidgetProps extends WidgetElementProps {
  /** Language of boards saved when it was a widget setting; now the fallback for `persisted.language`. */
  language?: EditorLanguage;
}

interface EditorPersistedState {
  content?: string;
  targetWKey?: string;
  language?: EditorLanguage;
  /** Whether the output zone is shown. Absent means shown. */
  outputOpen?: boolean;
  [key: string]: any;
}

const EditorWidget: React.FC<EditorWidgetProps> = (props) => {
  const { wKey, isStatic, containerRef, language: legacyLanguage = 'sql' } = props;
  const [colors] = useAppColors();
  const { colorMode } = useColorMode();

  const alert = useUserAlert();
  const [persisted, setPersisted] = useWidgetState<EditorPersistedState>(wKey);

  const [language, setLanguage] = React.useState<EditorLanguage>(() => persisted.language ?? legacyLanguage);
  const languageRef = React.useRef(language);
  languageRef.current = language;
  const [content, setContent] = React.useState<string>(
    () => persisted.content ?? DEFAULT_SNIPPETS[persisted.language ?? legacyLanguage] ?? ''
  );
  const [targetWKey, setTargetWKey] = React.useState<string | undefined>(persisted.targetWKey);
  const [running, setRunning] = React.useState(false);
  // The output zone's run log (kept in memory only) and whether it is shown.
  const [log, setLog] = React.useState<OutputEntry[]>([]);
  const [outputOpen, setOutputOpen] = React.useState<boolean>(persisted.outputOpen ?? true);
  // entries that arrived while the zone was hidden
  const [unread, setUnread] = React.useState(0);
  const nextEntryId = React.useRef(1);
  const outputOpenRef = React.useRef(outputOpen);
  outputOpenRef.current = outputOpen;
  const record = React.useCallback((result: RunResult) => {
    const entry = makeEntry(nextEntryId.current++, Date.now(), languageRef.current, result);
    setLog((l) => appendEntry(l, entry));
    if (!outputOpenRef.current) setUnread((n) => n + 1);
  }, []);
  // Where the output zone is docked and how big it is; both saved with the widget.
  const [outputDock, setOutputDock] = React.useState<Dock>(() => normalizeDock(persisted.outputDock));
  const [outputSize, setOutputSize] = React.useState<number>(() =>
    typeof persisted.outputSize === 'number' ? persisted.outputSize : defaultSize(normalizeDock(persisted.outputDock)));
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const runLabel = runLabelMode(useElementWidth(toolbarRef));
  const zoneFirst = dockComesFirst(outputDock);
  const changeDock = (next: Dock) => {
    if (next === outputDock) return;
    // a height and a width aren't interchangeable, so switching between the two starts from the default
    const size = isSideDock(next) === isSideDock(outputDock) ? outputSize : defaultSize(next);
    setOutputDock(next);
    setOutputSize(size);
    setPersisted({ outputDock: next, outputSize: size });
  };
  const dragging = React.useRef(false);
  const onDividerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onDividerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const body = bodyRef.current;
    if (!dragging.current || !body) return;
    const rect = body.getBoundingClientRect();
    setOutputSize(clampSize(outputDock, sizeFromPointer(outputDock, rect, e.clientX, e.clientY), rect));
  };
  const onDividerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setPersisted({ outputSize });
  };
  const toggleOutput = () => {
    const next = !outputOpen;
    setOutputOpen(next);
    if (next) setUnread(0);
    setPersisted({ outputOpen: next });
  };

  // getContent() (published below) must always see the latest content even
  // though publish only re-runs when [language, targetWKey] change.
  const contentRef = React.useRef(content);
  contentRef.current = content;

  const editorRef = React.useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const completionDisposableRef = React.useRef<Monaco.IDisposable | null>(null);

  const ownName = useWidgetStore((s) => s.widgets[wKey]?.name ?? 'SQL editor');
  const tableWidgets = useWidgetsByType('table');
  const targetRecord = tableWidgets.find((w) => w.wKey === targetWKey);
  const isDangling = !!targetWKey && !targetRecord;
  const targetExports = useWidgetExports<TableWidgetExports>(targetWKey);
  const isConnected = !!targetWKey && !isDangling && !!targetExports;

  // Table <-> editor is 1:1 - a table already claimed by a different editor
  // is offered (so its name is visible) but not selectable.
  const editorLinks = useEditorLinks();
  const linkedElsewhere = React.useMemo(
    () => new Set(
      Object.entries(editorLinks)
        .filter(([, editor]) => editor.wKey !== wKey)
        .map(([tableWKey]) => tableWKey)
    ),
    [editorLinks, wKey]
  );

  // Live completion sources: table names + column names of every table
  // widget currently on the board, kept in a ref so the completion provider
  // (registered once, on editor mount) always reads the current set without
  // needing to be re-registered.
  const tableExportsMap = useWidgetStore(
    useShallow((s) => {
      const map: Record<string, TableWidgetExports> = {};
      for (const w of tableWidgets) {
        const exp = s.exports[w.wKey];
        if (exp) map[w.wKey] = exp as unknown as TableWidgetExports;
      }
      return map;
    })
  );
  const completionSources: CompletionSource[] = React.useMemo(
    () => tableWidgetsToCompletionSources(tableWidgets.map((w) => tableExportsMap[w.wKey])),
    [tableWidgets, tableExportsMap]
  );
  const sourcesRef = React.useRef(completionSources);
  sourcesRef.current = completionSources;

  // Debounced persistence - do not write to the store on every keystroke.
  const persistContent = React.useMemo(
    () => debounce((value: string) => setPersisted({ content: value }), 500),
    [setPersisted]
  );
  React.useEffect(() => () => persistContent.cancel(), [persistContent]);

  const handleChange: OnChange = (value) => {
    const v = value ?? '';
    setContent(v);
    persistContent(v);
  };

  const handleTargetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const wk = e.target.value || undefined;
    if (wk && linkedElsewhere.has(wk)) {
      const owner = editorLinks[wk];
      alert(
        'Table already linked',
        'warning',
        `"${tableWidgets.find((w) => w.wKey === wk)?.name ?? wk}" is already linked to "${owner?.name ?? 'another editor'}" - disconnect it there first.`,
      );
      return;
    }
    setTargetWKey(wk);
    setPersisted({ targetWKey: wk });
  };

  const handleLanguageChange = React.useCallback((next: EditorLanguage) => {
    setLanguage(next);
    // An untouched starter snippet follows the language; anything the user wrote stays.
    const untouched = !contentRef.current.trim() || contentRef.current === DEFAULT_SNIPPETS[language];
    const patch: Partial<EditorPersistedState> = { language: next };
    if (untouched) {
      const starter = DEFAULT_SNIPPETS[next] ?? '';
      setContent(starter);
      patch.content = starter;
    }
    setPersisted(patch);
  }, [language, setPersisted]);
  const handleLanguageChangeRef = React.useRef(handleLanguageChange);
  handleLanguageChangeRef.current = handleLanguageChange;

  // Linking a table (or its engine changing) switches a SQL/qpl editor to that
  // engine's language: the other one can't query it. It only fires when the
  // link or engine changes, so a language chosen afterwards is left alone.
  const linkedEngine = targetExports?.engine;
  React.useEffect(() => {
    const want = languageForEngine(linkedEngine);
    if (want && isRunnableLanguage(language) && language !== want) handleLanguageChangeRef.current(want);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetWKey, linkedEngine]);

  const handleRun = React.useCallback(async () => {
    if (language !== 'sql' && language !== 'qpl') return;
    if (!targetWKey) {
      record({ ok: false, message: 'Pick a target table widget first.' });
      return;
    }
    if (isDangling || !targetExports) {
      record({ ok: false, message: 'Linked widget no longer exists - pick another table.' });
      return;
    }
    setRunning(true);
    try {
      const args = [contentRef.current, targetExports, { wKey, name: ownName }] as const;
      if (language === 'qpl') {
        const { totalRows, elapsedMs, output, returnedTable } = await runQplAgainstTarget(...args);
        record({ ok: true, rows: returnedTable ? totalRows : undefined, elapsedMs, output });
      } else {
        const { totalRows, elapsedMs } = await runSqlAgainstTarget(...args);
        record({ ok: true, rows: totalRows, elapsedMs });
      }
    } catch (err: any) {
      record({ ok: false, message: err?.message ?? String(err), output: err instanceof QplRunError ? err.output : undefined });
    } finally {
      setRunning(false);
    }
  }, [language, targetWKey, isDangling, targetExports, wKey, ownName, record]);

  // addCommand captures whatever handleRun was at mount time - keep a ref so
  // Ctrl/Cmd+Enter always calls the latest version.
  const handleRunRef = React.useRef(handleRun);
  handleRunRef.current = handleRun;

  const monacoRef = React.useRef<typeof Monaco | null>(null);

  // The qpl language is defined by the wasm module, so it registers
  // asynchronously; (re)apply it to the model once it has. Runs on mount and
  // whenever the resolved language becomes qpl (e.g. after linking a qpl table).
  const applyQplLanguage = React.useCallback(() => {
    const monacoInstance = monacoRef.current;
    const editor = editorRef.current;
    if (language !== 'qpl' || !monacoInstance || !editor) return;
    ensureQplLanguage(monacoInstance)
      .then(() => {
        const model = editor.getModel();
        if (model) monacoInstance.editor.setModelLanguage(model, 'qpl');
      })
      .catch((err) => alert('qpl language unavailable', 'fail', err?.message ?? String(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);
  const applyQplLanguageRef = React.useRef(applyQplLanguage);
  applyQplLanguageRef.current = applyQplLanguage;
  React.useEffect(() => { applyQplLanguage(); }, [applyQplLanguage]);

  const handleEditorMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter, () => {
      handleRunRef.current();
    });
    completionDisposableRef.current = registerSqlCompletions(monacoInstance, () => sourcesRef.current);
    monacoRef.current = monacoInstance;
    applyQplLanguageRef.current();
  };

  React.useEffect(
    () => () => {
      completionDisposableRef.current?.dispose();
      completionDisposableRef.current = null;
    },
    []
  );

  // Monaco does not reliably self-size inside a flex/dockview panel.
  // `automaticLayout` covers most resizes; back it with a ResizeObserver on
  // the widget's own container for the cases it misses (e.g. dockview
  // splitting a group without a window resize event).
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      editorRef.current?.layout();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef]);

  const exportsForPublish = React.useMemo<EditorWidgetExports>(
    () => ({
      language,
      getContent: () => contentRef.current,
      targetWKey,
    }),
    [language, targetWKey]
  );
  usePublishExports(wKey, exportsForPublish as unknown as WidgetExports, [language, targetWKey]);

  const isRunnable = isRunnableLanguage(language);

  return (
    <Box
      h="100%"
      w="100%"
      display="flex"
      flexDirection="column"
      onMouseDown={stopPropagation}
      onTouchStart={stopPropagation}
    >
      <Box ref={toolbarRef} borderBottom="1px solid" borderColor={colors.foreQuarter} px={2} py={1} flexShrink={0}>
        {/* Controls shrink before the Run label does, and wrap to a second row as a last resort, so the bar never overflows. */}
        <Flex gap={2} align="center" wrap="wrap">
          {isRunnable ? (
            <Select
              size="sm"
              flex="1 1 140px"
              minW="90px"
              maxW="220px"
              placeholder="Target table widget..."
              value={targetWKey ?? ''}
              onChange={handleTargetChange}
              color={colors.fore}
              borderColor={colors.foreQuarter}
            >
              {tableWidgets.map((w) => (
                <option key={w.wKey} value={w.wKey} disabled={linkedElsewhere.has(w.wKey)}>
                  {w.name}{linkedElsewhere.has(w.wKey) ? ` (linked to ${editorLinks[w.wKey]?.name})` : ''}
                </option>
              ))}
            </Select>
          ) : null}
          <Select
            size="sm"
            flex="0 1 140px"
            minW="84px"
            aria-label="Language"
            title="Language. SQL runs on DuckDB and qpl on the qpl engine; linking a table picks the one that matches it."
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value as EditorLanguage)}
            isDisabled={isStatic}
            color={colors.fore}
            borderColor={colors.foreQuarter}
          >
            {EDITOR_LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </Select>
          {isRunnable ? (
            <>
              <Button
                size="sm"
                colorScheme="blue"
                flexShrink={0}
                minW={0}
                maxW="100%"
                isLoading={running}
                isDisabled={isStatic || !targetWKey}
                onClick={handleRun}
                // the shortcut lives in the tooltip once the label drops it
                title={RUN_SHORTCUT_LABEL}
                aria-label={RUN_SHORTCUT_LABEL}
                leftIcon={runLabel === 'icon' ? undefined : <FaPlay size={10} />}
                {...(runLabel === 'icon' ? { px: 2 } : {})}
              >
                {runLabel === 'icon' ? (
                  <FaPlay size={12} />
                ) : (
                  // truncates with an ellipsis if even this tier doesn't fit
                  <Text as="span" isTruncated>{runLabel === 'full' ? RUN_SHORTCUT_LABEL : 'Run'}</Text>
                )}
              </Button>
              <ConnectionBadge connected={isConnected} label={isConnected ? targetRecord?.name : undefined} />
              <Button
                size="sm"
                flexShrink={0}
                variant={outputOpen ? 'solid' : 'outline'}
                onClick={toggleOutput}
                title={outputOpen ? 'Hide the output zone' : 'Show the output zone'}
              >
                Output{!outputOpen && unread > 0 ? ` (${unread})` : ''}
              </Button>
              {isDangling ? (
                <Text color={colors.fail} fontSize="sm">
                  Linked widget no longer exists
                </Text>
              ) : null}
              {running ? <Spinner size="sm" color={colors.info} /> : null}
            </>
          ) : null}
        </Flex>
      </Box>
      <Box
        ref={bodyRef}
        flex="1"
        minH={0}
        minW={0}
        display="flex"
        flexDirection={isSideDock(outputDock) ? 'row' : 'column'}
      >
        {/* The children stay in a fixed DOM order and flex `order` moves the zone
            to the other side, so changing the dock never remounts Monaco. */}
        <Box flex="1" minH={0} minW={0} order={zoneFirst ? 2 : 0}>
          <Editor
            language={language}
            value={content}
            theme={colorMode === 'dark' ? 'vs-dark' : 'light'}
            onChange={handleChange}
            onMount={handleEditorMount}
            options={{
              readOnly: isStatic,
              automaticLayout: true,
              minimap: { enabled: false },
              fontSize: 13,
            }}
          />
        </Box>
        {isRunnable && outputOpen ? (
          <>
            <Box
              order={1}
              flexShrink={0}
              {...(isSideDock(outputDock)
                ? { w: '5px', cursor: 'col-resize' }
                : { h: '5px', cursor: 'row-resize' })}
              bg={colors.foreQuarter}
              _hover={{ bg: colors.info }}
              style={{ touchAction: 'none' }}
              onPointerDown={onDividerDown}
              onPointerMove={onDividerMove}
              onPointerUp={onDividerUp}
              onPointerCancel={onDividerUp}
            />
            <EditorOutput
              order={zoneFirst ? 0 : 2}
              entries={log}
              dock={outputDock}
              size={outputSize}
              onDockChange={changeDock}
              onClear={() => setLog([])}
              onHide={toggleOutput}
            />
          </>
        ) : null}
      </Box>
    </Box>
  );
};

export default EditorWidget;
