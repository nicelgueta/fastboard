import {
    Accordion,
    Drawer,
    DrawerBody,
    DrawerFooter,
    DrawerHeader,
    DrawerOverlay,
    DrawerContent,
    DrawerCloseButton,
  } from '@chakra-ui/react'
import React from 'react';
import NavMenuSection from './menu-section';
import NavConfig from "./config";
import { useColorMode } from '@chakra-ui/color-mode';

function NavMenu(props) {
    const { colorMode, } = useColorMode();
    const colorScheme = colorMode==="dark" ? "orange" : "cyan";
    return (
      <>
        <Drawer
          isOpen={props.navOpen}
          placement='left'
          onClose={props.navClose}
          finalFocusRef={props.btnRef}
        >
          <DrawerOverlay />
          <DrawerContent>
            <DrawerCloseButton />
            <DrawerHeader>e3 Menu</DrawerHeader>
  
            <DrawerBody>
              <Accordion allowMultiple colorScheme={colorScheme}>
              {NavConfig.map(
                (x,i)=>
                <NavMenuSection key={`NavMenuSection-${i}`} navClose={props.navClose} {...x} />
                )}
              </Accordion>
            </DrawerBody>
  
            <DrawerFooter>

            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </>
    )
  }
export default NavMenu;