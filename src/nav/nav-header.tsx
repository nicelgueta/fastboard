import React from 'react';
import { Heading, HStack, IconButton } from '@chakra-ui/react';
import { ColorModeSwitcher } from '../components/ColorModeSwitcher';
import Appearance from '../components/Appearance';
import { MdMenu, MdHelpOutline } from 'react-icons/md';
import { AiOutlineGithub } from 'react-icons/ai';
import useAppColors from '../hooks/useAppColors';
import ToolMenu, { ToolMenuItem } from './ToolMenu';
import FBIconButton from '../components/primitive/IconButton';
import { VscSave, VscSaveAs, VscRefresh } from "react-icons/vsc";
import { useWidgetStore } from '../store/widgetStore';
import { useShallow } from 'zustand/react/shallow';
import type { SerializedDockview } from 'dockview-react';
import {
    BaseWidgetDict, WidgetDict
} from '../interfaces';
import useUserAlert from '../hooks/useUserAlert';
import useKvStore from '../hooks/useKvStore';
import SaveAsModal from '../modals/SaveAsModal';
import IntroModal, { INTRO_VERSION, INTRO_SEEN_KEY } from '../intro/IntroModal';

interface NavHeaderProps {
  toggleNav: (menuOpen: boolean) => void;
  menuOpen: boolean;
  addWidget: (type: string, savedWidget?: WidgetDict) => void;
  allWidgets: BaseWidgetDict[];
  getCurrentLayout: () => SerializedDockview | undefined;
  resetLayout: () => void;
  currentWidgets: WidgetDict[];
  appName: string;
  loadBoard: (boardKey: string) => void;
  currentBoardKey: string;
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
  currentBoardKey
}) => {
  
  const [colors] = useAppColors();
  const txtColor = colors.fore;
  const [saveAsOpen, setSaveAsOpen] = React.useState(false);
  const {set: setSavedBoard, list: listAllBoardKeys} = useKvStore('allBoards');
  const {list: listSavedSettings, get:getSavedSettings} = useKvStore('saved_widgets');
  const [allBoardKeys, setAllBoardKeys] = React.useState<string[]>([]);
  const {get: getPref, set: setPref} = useKvStore('prefs');
  const [introOpen, setIntroOpen] = React.useState(false);

  // First-run check: useKvStore().get() returns JSON.parse(... || "{}"), so
  // a key that was never set comes back as {} rather than undefined - guard
  // with a typeof check (same pattern Phase 1 used for the accent color
  // preference) rather than trusting the value's shape. Reading a value and
  // calling setState with it is inherently idempotent, so this is safe to
  // run twice under React 18 StrictMode's double-invoked effects.
  React.useEffect(() => {
    const seenVersion = getPref(INTRO_SEEN_KEY);
    if (typeof seenVersion !== 'number' || seenVersion < INTRO_VERSION) {
      setIntroOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissIntro = (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      setPref(INTRO_SEEN_KEY, INTRO_VERSION);
    }
  };

  const widgetStates = useWidgetStore(useShallow((s) => s.states));

  React.useEffect(() => {
    const abk = listAllBoardKeys();
    if (abk) {
      setAllBoardKeys(abk);
    }
  },[saveAsOpen]);

  const userAlert = useUserAlert();

  const allWidgetItems: ToolMenuItem[] = allWidgets.map((widget) => {
    const existingCount = currentWidgets.filter(w => w.type === widget.type).length;
    return {
      label: widget.name,
      value: widget.type,
      description: widget.description,
      disabled: existingCount >= widget.maxNo,
    };
  });

  const layoutItems: ToolMenuItem[] = allBoardKeys.map(k => ({
    label: k,
    value: k
  }));

  const savedToolItems: ToolMenuItem[] = listSavedSettings().map(x => ({
    label: x,
    value: x
  }));

  const loadWidget = (widgetKey: string) => {
    const {type: widgetType, settings:widgetSettings} = getSavedSettings(widgetKey);
    if (!widgetSettings) {
      userAlert(
        `Widget settings not found`,
        'fail'
      );
      return;
    }
    addWidget(widgetType, widgetSettings);
  }
  const saveBoard = (key: string) => {
    const layout = getCurrentLayout();
    if (!layout) {
      return;
    }
    const savedBoard = {
      name: key,
      key: key,
      layout,
      widgets: currentWidgets,
      widgetStates: widgetStates
    };
    setSavedBoard(savedBoard.key, savedBoard);

    userAlert(
      `"${savedBoard.name}" has been saved`,
      'success'
    )
  }

  const saveBoardAs = () => {
    setSaveAsOpen(true);
  }


  return (
    <>
    <IntroModal
      isOpen={introOpen}
      setIsOpen={setIntroOpen}
      onDismiss={dismissIntro}
    />
    <SaveAsModal
      storeName={"allBoards"}
      objToSave={{layout: getCurrentLayout(), widgets: currentWidgets, widgetStates}}
      isOpen={saveAsOpen}
      setIsOpen={setSaveAsOpen}
      helperText='Provide a name for your board layout.'
      callback={(k)=>userAlert(`"${k}" has been saved`,'success')}

    />
    <HStack
      h="100%"
      w="100%"
      textAlign="left"
      bg={colors.bgHalf}
      spacing={4}
      px={2}
      justify="space-between"
    >
      <HStack flexShrink={0}>
        <Heading
            alignSelf="center"
            paddingLeft={1}
            alignContent="center"
            fontSize={18}
            bgClip='text'
            bgGradient={`linear(to-r, ${colors.fore}, ${colors.fore})`}
        >
            {appName}
        </Heading>
      </HStack>

      <HStack spacing={2} py={1} justify="center" flex={1} minW={0} overflowX="auto">
        <ToolMenu
          label="Boards"
          items={layoutItems}
          onSelect={loadBoard}
          typ="info"
          emptyText="No saved boards"
          hotkey="Digit1"
        />
        <FBIconButton
          aria-label='save-board'
          typ="info"
          size={"sm"}
          onClick={()=>saveBoard(currentBoardKey)}
          icon={<VscSave fontSize={16} />}
          isDisabled={currentBoardKey === ''}
        />
        <FBIconButton
          aria-label='save-board-as'
          typ="success"
          size={"sm"}
          onClick={saveBoardAs}
          icon={<VscSaveAs fontSize={16} />}
        />
        <FBIconButton
          aria-label='reset-layout'
          typ="warning"
          size={"sm"}
          onClick={resetLayout}
          icon={<VscRefresh fontSize={16} />}
        />
        <ToolMenu
          label="Add tool"
          items={allWidgetItems}
          onSelect={addWidget}
          typ="success"
          emptyText="No tools available"
        />
        <ToolMenu
          label="Saved tools"
          items={savedToolItems}
          onSelect={loadWidget}
          typ="info"
          emptyText="No saved tools"
        />
      </HStack>

      <HStack flexShrink={0}>
        <IconButton
          aria-label='help'
          variant="ghost"
          size="sm"
          color={txtColor}
          onClick={() => setIntroOpen(true)}
        >
          <MdHelpOutline size={26} />
        </IconButton>
        <IconButton
          aria-label='drawer-toggle'
          variant="ghost"
          size="sm"
          color={txtColor}
          onClick={() => toggleNav(!menuOpen)}
        >
          <MdMenu size={30} />
        </IconButton>
        <IconButton
          aria-label='gh-profile'
          variant="ghost"
          size="sm"
          color={txtColor}
          onClick={() => window.open('https://github.com/nicelgueta', '_blank')?.focus()}
        >
          <AiOutlineGithub size={30} />
        </IconButton>
        <Appearance />
        <ColorModeSwitcher
          aria-label='color-mode-switcher'
          color={txtColor}
          justifySelf="flex-end"
        />
      </HStack>
    </HStack>
    </>
  );
};

export default NavHeader;
