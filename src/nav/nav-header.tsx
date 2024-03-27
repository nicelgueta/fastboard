import React from 'react';
import { Grid, GridItem, Heading, HStack, Center, IconButton } from '@chakra-ui/react';
// import { ColorModeSwitcher } from '../components/ColorModeSwitcher';
import { MdMenu } from 'react-icons/md';
import { AiOutlineGithub } from 'react-icons/ai';
import useAppColors from '../hooks/useAppColors';
import TextSearch,  { OptionItem } from '../components/TextSearch';
import FBIconButton from '../components/primitive/IconButton';
import { VscSave, VscSaveAs, VscRefresh } from "react-icons/vsc";
import { AllWidgetStates } from '../reducers/recoilStates';
import { useRecoilState } from 'recoil';
import {
    BaseWidgetDict, Layout, WidgetDict
} from '../interfaces';
import useUserAlert from '../hooks/useUserAlert';
import useKvStore from '../hooks/useKvStore';
import SaveAsModal from '../modals/SaveAsModal';

interface NavHeaderProps {
  toggleNav: (menuOpen: boolean) => void;
  menuOpen: boolean;
  addWidget: (type: string, savedWidget?: WidgetDict) => void; 
  allWidgets: BaseWidgetDict[]; 
  currentLayout: Layout[];
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
  currentLayout,
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

  const [widgetStates] = useRecoilState(AllWidgetStates);

  React.useEffect(() => {
    const abk = listAllBoardKeys();
    if (abk) {
      setAllBoardKeys(abk);
    }
  },[saveAsOpen]);

  const userAlert = useUserAlert();

  const allWidgetItems: OptionItem[] = allWidgets.map((widget, i) => ({
    label: widget.name,
    value: widget.type
  }));

  const layoutItems: OptionItem[] = allBoardKeys.map(k=> ({
    label: k,
    value: k
  }));
  // console.log(layoutItems)
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
    const savedBoard = {
      name: key,
      key: key,
      layout: currentLayout,
      widgets: currentWidgets,
      widgetStates: widgetStates
    };
    console.log(savedBoard)
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
    <SaveAsModal
      storeName={"allBoards"}
      objToSave={{layout: currentLayout, widgets: currentWidgets}}
      isOpen={saveAsOpen}
      setIsOpen={setSaveAsOpen}
      helperText='Provide a name for your board layout.'
      callback={(k)=>userAlert(`"${k}" has been saved`,'success')}

    />
    <Grid h="100%" textAlign="left" templateColumns='repeat(20, 1fr)' bg={colors.bgHalf}>
      <GridItem colSpan={1} padding={1}>
        <HStack h="100%">
          <Center>
            <Heading
                alignSelf="center"
                paddingLeft={1}
                h="100%"
                alignContent="center"
                fontSize={18}
                bgClip='text'
                bgGradient={`linear(to-r, ${colors.fore}, ${colors.fore})`}
            >
                {appName}
            </Heading>
          </Center>
        </HStack>
      </GridItem>
      <GridItem colSpan={4} padding={1}>
        <Center w="100%" h="100%">
          <HStack w="100%" h="100%" spacing={1}>
            <TextSearch
              w="100%"
              h="100%"
              placeholder="Dashboard"
              items={layoutItems}
              callback={loadBoard}
              buttonText="LOAD"
              buttonType="info"
              showlabel
              openHotkey='Digit1'
            />
            <FBIconButton
              aria-label='save-board'
              typ="info"
              size={"sm"}
              h="100%"
              onClick={()=>saveBoard(currentBoardKey)}
              icon={<VscSave fontSize={16} />}
              isDisabled={currentBoardKey === ''}
            />
            <FBIconButton
              aria-label='save-board-as'
              typ="success"
              size={"sm"}
              h="100%"
              onClick={saveBoardAs}
              icon={<VscSaveAs fontSize={16} />}
            />
            <FBIconButton
              aria-label='reset-layout'
              typ="warning"
              size={"sm"}
              h="100%"
              onClick={resetLayout}
              icon={<VscRefresh fontSize={16} />}
            />
            
          </HStack>
        </Center>
      </GridItem>
      <GridItem colSpan={3} padding={1}>
        <Center w="100%" h="100%">
          <TextSearch
            w="100%"
            h="100%"
            placeholder="New tool"
            items={allWidgetItems}
            callback={addWidget}
            buttonText="ADD"
            buttonType="success"
            clearOnSelect
          />
        </Center>
      </GridItem>
      <GridItem colSpan={3} padding={1}>
        <Center w="100%" h="100%">
          <TextSearch
            w="100%"
            h="100%"
            placeholder="Saved tool"
            items={listSavedSettings().map(x=>({label: x, value: x}))}
            callback={loadWidget}
            buttonText="LOAD"
            buttonType="info"
            clearOnSelect
          />
        </Center>
      </GridItem>
      <GridItem justifySelf="flex-end" colSpan={9}>
        <HStack>
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
          {/* <ColorModeSwitcher 
            aria-label='color-mode-switcher'
            color={txtColor} 
            justifySelf="flex-end" 
          /> */}
        </HStack>
      </GridItem>
    </Grid>
    </>
  );
};

export default NavHeader;
