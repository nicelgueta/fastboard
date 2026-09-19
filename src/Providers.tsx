import React from 'react';
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import theme, { colorModeManager } from './theme';
import { AppearanceProvider } from './hooks/useAppColors';

/**
 * Theme + colour mode + accent for the whole app. Lives above the router so the
 * landing page and the board share one colour mode (and the landing page does
 * not have to import the board, dockview and everything under it to get one).
 */
const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <>
        <ColorModeScript
            initialColorMode="dark"
            type="localStorage"
            storageKey="fastboard-color-mode"
        />
        <ChakraProvider theme={theme} colorModeManager={colorModeManager}>
            <AppearanceProvider>{children}</AppearanceProvider>
        </ChakraProvider>
    </>
);

export default Providers;
