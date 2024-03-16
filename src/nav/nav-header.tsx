import React from 'react';
import { Grid, GridItem, Heading, HStack, Center, IconButton } from '@chakra-ui/react';
import { ColorModeSwitcher } from '../components/ColorModeSwitcher';
import { MdAccountCircle, MdMenu } from 'react-icons/md';
import { AiOutlineGithub } from 'react-icons/ai';
import { useColorMode } from '@chakra-ui/color-mode';
import useAppColors from '../hooks/colors';
import TextSearch from '../components/TextSearch';
import Button from '../components/Button'; 

import {
    BaseWidgetDict, SavedBoard
} from '../interfaces';

interface NavHeaderProps {
  toggleNav: (menuOpen: boolean) => void;
  menuOpen: boolean;
  addWidget: (wKey: string) => void; 
  allWidgets: BaseWidgetDict[]; 
  boards?: SavedBoard[]; 
  appName: string;
}

const NavHeader: React.FC<NavHeaderProps> = ({
  toggleNav,
  menuOpen,
  addWidget,
  allWidgets,
  boards,
  appName
}) => {
  const { colorMode } = useColorMode();
  const colors = useAppColors();
  const txtColor = colors.fore;

  const allWidgetItems = allWidgets.map((widget, i) => ({
    label: widget.name,
    value: widget.type
  }));

  const layoutItems = boards?.map((board, i) => ({
    label: board.name,
    value: board.key
  }));

  return (
    <Grid textAlign="left" templateColumns='repeat(20, 1fr)' bg={colors.bgHalf}>
      <GridItem colSpan={1} padding={1}>
        <HStack h="100%">
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
              callback={() => alert('load layout')}
              buttonText="LOAD"
              buttonType="warning"
            />
            <Button
              type="action"
              h="85%"
              onClick={() => alert('save layout')}
            >
              SAVE
            </Button>
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
          <ColorModeSwitcher color={txtColor} justifySelf="flex-end" />
        </HStack>
      </GridItem>
    </Grid>
  );
};

export default NavHeader;
