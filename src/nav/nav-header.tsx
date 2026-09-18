import React from 'react';
import { Box, Divider, Heading, HStack, IconButton, Tooltip } from '@chakra-ui/react';
import { ColorModeSwitcher } from '../components/ColorModeSwitcher';
import Appearance from '../components/Appearance';
import { MdMenu, MdHelpOutline, MdSettings, MdAdd } from 'react-icons/md';
import { AiOutlineGithub } from 'react-icons/ai';
import useAppColors from '../hooks/useAppColors';
import ToolMenu, { ToolMenuItem } from './ToolMenu';
import BoardMenu from './BoardMenu';
import AppSettingsModal from '../components/AppSettingsModal';
import { useWidgetStore } from '../store/widgetStore';
import { useShallow } from 'zustand/react/shallow';
import type { SerializedDockview } from 'dockview-react';
import { BaseWidgetDict, WidgetDict } from '../interfaces';
import useUserAlert from '../hooks/useUserAlert';
import useKvStore from '../hooks/useKvStore';
import { getStorage } from '../store/storage';
import SaveAsModal from '../modals/SaveAsModal';
import IntroModal, { INTRO_VERSION, INTRO_SEEN_KEY } from '../intro/IntroModal';

interface NavHeaderProps {
  toggleNav: (menuOpen: boolean) => void;
  menuOpen: boolean;
  addWidget: (type: string, savedWidget?: Record<string, any>) => void;
  allWidgets: BaseWidgetDict[];
  getCurrentLayout: () => SerializedDockview | undefined;
  resetLayout: () => void;
  currentWidgets: WidgetDict[];
  appName: string;
  loadBoard: (boardKey: string) => Promise<void>;
  currentBoardKey: string;
  setCurrentBoardKey: (key: string) => void;
}

const NavHeader: React.FC<NavHeaderProps> = ({
  toggleNav,
  menuOpen,
  addWidget,
  allWidgets,
  appName,
  getCurrentLayout,
  resetLayout,
  currentWidgets,
  loadBoard,
  currentBoardKey,
  setCurrentBoardKey,
}) => {
  const [colors] = useAppColors();
  const txtColor = colors.fore;
  const [saveAsOpen, setSaveAsOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [allBoardKeys, setAllBoardKeys] = React.useState<string[]>([]);
  const [savedToolKeys, setSavedToolKeys] = React.useState<string[]>([]);
  const { get: getPref, set: setPref } = useKvStore('prefs');
  const [introOpen, setIntroOpen] = React.useState(false);

  // First-run check: useKvStore().get() returns JSON.parse(... || "{}"), so a
  // key that was never set comes back as {} rather than undefined - guard with
  // a typeof check rather than trusting the value's shape. Reading a value and
  // calling setState with it is idempotent, so this is safe under React 18
  // StrictMode's double-invoked effects.
  React.useEffect(() => {
    const seenVersion = getPref(INTRO_SEEN_KEY);
    if (typeof seenVersion !== 'number' || seenVersion < INTRO_VERSION) {
      setIntroOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissIntro = (dontShowAgain: boolean) => {
    if (dontShowAgain) setPref(INTRO_SEEN_KEY, INTRO_VERSION);
  };

  const widgetStates = useWidgetStore(useShallow((s) => s.states));
  const userAlert = useUserAlert();

  // Storage is pluggable now (localStorage by default, a REST backend when
  // configured in app settings), so these reads are async.
  const refreshLists = React.useCallback(async () => {
    const store = getStorage();
    try {
      setAllBoardKeys(await store.list('boards'));
      setSavedToolKeys(await store.list('saved_widgets'));
    } catch (e) {
      userAlert('Could not list saved items', 'fail', e instanceof Error ? e.message : String(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => { void refreshLists(); }, [refreshLists, saveAsOpen, settingsOpen]);

  // "Unsaved changes" marker on the board name: any widget add/remove/rename
  // or settings change since the last save marks the board dirty.
  const [dirty, setDirty] = React.useState(false);
  const boardFingerprint = React.useMemo(
    () => JSON.stringify(currentWidgets.map((w) => [w.key, w.name, w.currentSettings])),
    [currentWidgets],
  );
  const savedFingerprint = React.useRef<string>(boardFingerprint);
  React.useEffect(() => {
    setDirty(boardFingerprint !== savedFingerprint.current);
  }, [boardFingerprint]);

  const markSaved = () => {
    savedFingerprint.current = boardFingerprint;
    setDirty(false);
  };

  // One menu for everything you can add: built-in tools first, then anything
  // the user saved a configuration for. Two separate dropdowns for these was
  // the clunky part - they answer the same question ("what goes on the board?").
  const addItems: ToolMenuItem[] = [
    ...allWidgets.map((widget) => {
      const existingCount = currentWidgets.filter((w) => w.type === widget.type).length;
      return {
        label: widget.name,
        value: `type:${widget.type}`,
        description: widget.description,
        group: 'Tools',
        disabled: existingCount >= widget.maxNo,
      };
    }),
    ...savedToolKeys.map((k) => ({
      label: k,
      value: `saved:${k}`,
      description: 'Saved configuration',
      group: 'Saved',
    })),
  ];

  const onAddSelect = async (value: string) => {
    if (value.startsWith('type:')) {
      addWidget(value.slice(5));
      return;
    }
    const key = value.slice(6);
    const saved = await getStorage().get<{ type: string; settings: Record<string, any> }>(
      'saved_widgets',
      key,
    );
    if (!saved?.settings) {
      userAlert('Widget settings not found', 'fail');
      return;
    }
    addWidget(saved.type, saved.settings);
  };

  const saveBoard = async (key: string) => {
    const layout = getCurrentLayout();
    if (!layout || !key) return;
    try {
      await getStorage().set('boards', key, {
        name: key,
        key,
        layout,
        widgets: currentWidgets,
        widgetStates,
      });
      markSaved();
      userAlert(`"${key}" saved`, 'success');
      void refreshLists();
    } catch (e) {
      userAlert('Save failed', 'fail', e instanceof Error ? e.message : String(e));
    }
  };

  const deleteBoard = async (key: string) => {
    if (!window.confirm(`Delete board "${key}"? This cannot be undone.`)) return;
    try {
      await getStorage().remove('boards', key);
      if (key === currentBoardKey) setCurrentBoardKey('');
      userAlert(`"${key}" deleted`, 'info');
      void refreshLists();
    } catch (e) {
      userAlert('Delete failed', 'fail', e instanceof Error ? e.message : String(e));
    }
  };

  const renameBoard = async () => {
    const next = window.prompt('Rename board', currentBoardKey);
    if (!next || !next.trim() || next.trim() === currentBoardKey) return;
    const name = next.trim();
    const previous = currentBoardKey;
    await saveBoard(name);
    await getStorage().remove('boards', previous);
    setCurrentBoardKey(name);
    void refreshLists();
  };

  const newBoard = () => {
    if (dirty && !window.confirm('Discard unsaved changes to this board?')) return;
    resetLayout();
    setCurrentBoardKey('');
    markSaved();
  };

  const iconBtn = {
    variant: 'ghost' as const,
    size: 'sm' as const,
    color: txtColor,
    borderRadius: 'md' as const,
    _hover: { bg: colors.surfaceSubtle },
  };

  return (
    <>
      <IntroModal isOpen={introOpen} setIsOpen={setIntroOpen} onDismiss={dismissIntro} />
      <AppSettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <SaveAsModal
        storeName={'boards'}
        objToSave={{ layout: getCurrentLayout(), widgets: currentWidgets, widgetStates }}
        isOpen={saveAsOpen}
        setIsOpen={setSaveAsOpen}
        helperText="Name this board."
        callback={(k) => {
          setCurrentBoardKey(k);
          void saveBoard(k);
        }}
      />

      <HStack h="100%" w="100%" bg={colors.surface} spacing={3} px={3} justify="space-between">
        <HStack spacing={3} minW={0} flexShrink={0}>
          <Heading fontSize={16} fontWeight={600} color={colors.fore} letterSpacing="-0.01em" flexShrink={0}>
            {appName}
          </Heading>
          <Divider orientation="vertical" h="20px" borderColor={colors.border} />
          <BoardMenu
            boards={allBoardKeys}
            currentBoard={currentBoardKey}
            dirty={dirty}
            onOpen={(k) => { void loadBoard(k).then(() => { setCurrentBoardKey(k); markSaved(); }); }}
            onSave={() => (currentBoardKey ? void saveBoard(currentBoardKey) : setSaveAsOpen(true))}
            onSaveAs={() => setSaveAsOpen(true)}
            onRename={() => void renameBoard()}
            onDelete={(k) => void deleteBoard(k)}
            onNew={newBoard}
          />
        </HStack>

        <HStack spacing={2} minW={0} flex={1} justify="center">
          <ToolMenu
            label="Add to board"
            items={addItems}
            onSelect={(v) => void onAddSelect(v)}
            typ="info"
            icon={<MdAdd />}
            emptyText="No tools available"
            hotkey="Digit1"
          />
        </HStack>

        <HStack spacing={1} flexShrink={0}>
          <Tooltip label="How to use FastBoard" openDelay={400}>
            <IconButton aria-label="help" {...iconBtn} icon={<MdHelpOutline size={20} />} onClick={() => setIntroOpen(true)} />
          </Tooltip>
          <Tooltip label="Menu" openDelay={400}>
            <IconButton aria-label="drawer-toggle" {...iconBtn} icon={<MdMenu size={20} />} onClick={() => toggleNav(!menuOpen)} />
          </Tooltip>
          <Tooltip label="GitHub" openDelay={400}>
            <IconButton
              aria-label="gh-profile"
              {...iconBtn}
              icon={<AiOutlineGithub size={20} />}
              onClick={() => window.open('https://github.com/nicelgueta', '_blank')?.focus()}
            />
          </Tooltip>
          <Box><Appearance /></Box>
          <ColorModeSwitcher aria-label="color-mode-switcher" {...iconBtn} />
          <Tooltip label="Settings" openDelay={400}>
            <IconButton
              aria-label="app-settings"
              {...iconBtn}
              icon={<MdSettings size={20} />}
              onClick={() => setSettingsOpen(true)}
            />
          </Tooltip>
        </HStack>
      </HStack>
    </>
  );
};

export default NavHeader;
