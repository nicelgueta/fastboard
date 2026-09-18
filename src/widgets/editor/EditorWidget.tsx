import React from 'react';
import { Box, HStack, Select, Button, Text, Spinner } from '@chakra-ui/react';
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

// Languages Monaco's basic-languages bundle (loaded as part of the
// `monaco-editor` package's default entry) ships highlighting for.
export type EditorLanguage =
  | 'sql'
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'json'
  | 'yaml'
  | 'markdown'
  | 'shell';

const DEFAULT_SNIPPETS: Partial<Record<EditorLanguage, string>> = {
  sql: '-- SELECT * FROM my_table WHERE x > 5\n',
};

interface EditorWidgetProps extends WidgetElementProps {
  language?: EditorLanguage;
}

interface EditorPersistedState {
  content?: string;
  targetWKey?: string;
  [key: string]: any;
}

interface RunOutcome {
  rows: number;
  elapsedMs: number;
  error?: string;
}

const EditorWidget: React.FC<EditorWidgetProps> = (props) => {
  const { wKey, isStatic, containerRef, language = 'sql' } = props;
  const [colors] = useAppColors();
  const { colorMode } = useColorMode();

  const alert = useUserAlert();
  const [persisted, setPersisted] = useWidgetState<EditorPersistedState>(wKey);

  const [content, setContent] = React.useState<string>(
    () => persisted.content ?? DEFAULT_SNIPPETS[language] ?? ''
  );
  const [targetWKey, setTargetWKey] = React.useState<string | undefined>(persisted.targetWKey);
  const [running, setRunning] = React.useState(false);
  const [outcome, setOutcome] = React.useState<RunOutcome | null>(null);

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
    setOutcome(null);
    setPersisted({ targetWKey: wk });
  };

  const handleRun = React.useCallback(async () => {
    if (language !== 'sql') return;
    if (!targetWKey) {
      setOutcome({ rows: 0, elapsedMs: 0, error: 'Pick a target table widget first.' });
      return;
    }
    if (isDangling || !targetExports) {
      setOutcome({ rows: 0, elapsedMs: 0, error: 'Linked widget no longer exists - pick another table.' });
      return;
    }
    setRunning(true);
    setOutcome(null);
    try {
      const { totalRows, elapsedMs } = await runSqlAgainstTarget(
        contentRef.current,
        targetExports,
        { wKey, name: ownName }
      );
      setOutcome({ rows: totalRows, elapsedMs });
    } catch (err: any) {
      setOutcome({ rows: 0, elapsedMs: 0, error: err?.message ?? String(err) });
    } finally {
      setRunning(false);
    }
  }, [language, targetWKey, isDangling, targetExports, wKey, ownName]);

  // addCommand captures whatever handleRun was at mount time - keep a ref so
  // Ctrl/Cmd+Enter always calls the latest version.
  const handleRunRef = React.useRef(handleRun);
  handleRunRef.current = handleRun;

  const handleEditorMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter, () => {
      handleRunRef.current();
    });
    completionDisposableRef.current = registerSqlCompletions(monacoInstance, () => sourcesRef.current);
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

  const isSql = language === 'sql';

  return (
    <Box
      h="100%"
      w="100%"
      display="flex"
      flexDirection="column"
      onMouseDown={stopPropagation}
      onTouchStart={stopPropagation}
    >
      {isSql ? (
        <Box borderBottom="1px solid" borderColor={colors.foreQuarter} px={2} py={1} flexShrink={0}>
          <HStack spacing={2}>
            <Select
              size="sm"
              w="220px"
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
            <Button
              size="sm"
              colorScheme="blue"
              isLoading={running}
              isDisabled={isStatic || !targetWKey}
              onClick={handleRun}
            >
              Run (Ctrl/Cmd+Enter)
            </Button>
            <ConnectionBadge connected={isConnected} label={isConnected ? targetRecord?.name : undefined} />
            {isDangling ? (
              <Text color={colors.fail} fontSize="sm">
                Linked widget no longer exists
              </Text>
            ) : null}
            {running ? <Spinner size="sm" color={colors.info} /> : null}
            {outcome && !running ? (
              outcome.error ? (
                <Text color={colors.fail} fontSize="sm" fontFamily="courier new" whiteSpace="pre-wrap">
                  {outcome.error}
                </Text>
              ) : (
                <Text color={colors.success} fontSize="sm">
                  {outcome.rows} rows in {outcome.elapsedMs.toFixed(0)} ms
                </Text>
              )
            ) : null}
          </HStack>
        </Box>
      ) : null}
      <Box flex="1" minH={0} minW={0}>
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
    </Box>
  );
};

export default EditorWidget;
