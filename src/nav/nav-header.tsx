import React from 'react';
import { Grid, GridItem, Heading, HStack, Center, IconButton } from '@chakra-ui/react';
import { ColorModeSwitcher } from '../components/ColorModeSwitcher';
import { MdAccountCircle, MdMenu } from 'react-icons/md';
import { AiOutlineGithub } from 'react-icons/ai';
import { useColorMode } from '@chakra-ui/color-mode';
import useAppColors from '../hooks/colors';
import TextSearch,  { OptionItem } from '../components/TextSearch';
import IconBu from '../components/IconButton';
import { VscSave, VscSaveAs } from "react-icons/vsc";
import {
    BaseWidgetDict, Layout, Board, WidgetDict
} from '../interfaces';
import useCustomToast from '../hooks/useCustomToast';

interface NavHeaderProps {
  toggleNav: (menuOpen: boolean) => void;
  menuOpen: boolean;
  addWidget: (wKey: string) => void; 
  allWidgets: BaseWidgetDict[]; 
  currentLayout: Layout[];
  currentWidgets: WidgetDict[];
  appName: string;
  loadBoard: (boardKey: string) => void;
}

const NavHeader: React.FC<NavHeaderProps> = ({
  toggleNav,
  menuOpen,
  addWidget,
  allWidgets,
  appName,
  currentLayout,
  currentWidgets,
  loadBoard
}) => {
  const { colorMode } = useColorMode();
  const colors = useAppColors();
  const txtColor = colors.fore;

  const [allBoards, setAllBoards] = React.useState<{[key: string]: Board}>({});

  React.useEffect(() => {
    const allBoardsJSON = localStorage.getItem('allBoards');
    if (allBoardsJSON) {
      setAllBoards(JSON.parse(allBoardsJSON));
    }
  },[]);

  const userAlert = useCustomToast();

  const allWidgetItems: OptionItem[] = allWidgets.map((widget, i) => ({
    label: widget.name,
    value: widget.type
  }));

  const layoutItems: OptionItem[] = Object.keys(allBoards).map(k=>allBoards[k]).map((board, i) => ({
    label: board.name,
    value: board.key
  }));

  const saveBoard = () => {
    const savedBoard = {
      name: 'My Board',
      key: 'currentBoard',
      layout: currentLayout,
      widgets: currentWidgets
    };

    const newAllBoards = {...allBoards};
    newAllBoards[savedBoard.key] = savedBoard;
    localStorage.setItem('allBoards', JSON.stringify(newAllBoards));
    localStorage.setItem("currentBoard", savedBoard.key);
    setAllBoards(newAllBoards);

    userAlert(
      `"${savedBoard.name}" has been saved`,
      'success'
    )
  }

  const saveBoardAs = () => {
    userAlert(
      `Save As is not implemented yet`,
      'warning'
    )
  }


  return (
    <Grid textAlign="left" templateColumns='repeat(20, 1fr)' bg={colors.bgHalf}>
      <GridItem colSpan={1} padding={1}>
        <HStack h="100%">
          <Center>
            <Heading
                alignSelf="center"
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
      <GridItem colSpan={3} padding={1}>
        <Center w="100%" h="100%">
          <HStack w="100%" h="100%" spacing={1}>
            <TextSearch
              w="100%"
              h="85%"
              placeholder="Layout"
              items={layoutItems}
              callback={loadBoard}
              buttonText="LOAD"
              buttonType="warning"
              showlabel
            />
            <IconBu
              aria-label='save-board'
              bType="action"
              size={"sm"}
              h="85%"
              onClick={saveBoard}
              icon={<VscSave />}
            />
            <IconBu
              aria-label='save-board-as'
              bType="action"
              size={"sm"}
              h="85%"
              onClick={saveBoardAs}
              icon={<VscSaveAs />}
            />
          </HStack>
        </Center>
      </GridItem>
      <GridItem colSpan={3} padding={1}>
        <Center w="100%" h="100%">
          <TextSearch
            w="100%"
            h="85%"
            placeholder="Tool"
            items={allWidgetItems}
            callback={addWidget}
            buttonText="ADD"
            buttonType="success"
            clearOnSelect
          />
        </Center>
      </GridItem>
      <GridItem justifySelf="flex-end" colSpan={13}>
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
          <ColorModeSwitcher 
            aria-label='color-mode-switcher'
            color={txtColor} 
            justifySelf="flex-end" 
          />
        </HStack>
      </GridItem>
    </Grid>
  );
};

export default NavHeader;
