import React from 'react';
import {
  Accordion,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
} from '@chakra-ui/react';
import NavMenuSection from './menu-section';
import NavConfig from './config';
import { useColorMode } from '@chakra-ui/color-mode';

interface NavMenuProps {
  navOpen: boolean;
  navClose: () => void;
  btnRef?: React.RefObject<HTMLButtonElement>;
  appName: string;
}

const NavMenu: React.FC<NavMenuProps> = ({
  navOpen,
  navClose,
  btnRef,
  appName,
}) => {
  const { colorMode } = useColorMode();
  const colorScheme = colorMode === 'dark' ? 'orange' : 'cyan';
  
  return (
    <>
      <Drawer
        isOpen={navOpen}
        placement='left'
        onClose={navClose}
        finalFocusRef={btnRef}
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>{appName}</DrawerHeader>

          <DrawerBody>
            <Accordion allowMultiple colorScheme={colorScheme}>
              {NavConfig.map((x, i) => (
                <NavMenuSection key={`NavMenuSection-${i}`} navClose={navClose} {...x} />
              ))}
            </Accordion>
          </DrawerBody>

          <DrawerFooter></DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default NavMenu;
