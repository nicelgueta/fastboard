import { extendTheme, ThemeConfig } from '@chakra-ui/react';
import { createLocalStorageManager } from '@chakra-ui/color-mode';

const config: ThemeConfig = {
    initialColorMode: 'dark',
    useSystemColorMode: false,
};

const theme = extendTheme({ config });

export default theme;

// FastBoard is dark-only: there's no in-app toggle, and system preference /
// a stale localStorage value (e.g. from before this app went dark-only)
// should never be able to switch it to light. This manager always reports
// "dark" and ignores writes, so ChakraProvider can't be steered away from it.
export const forcedDarkColorModeManager: ReturnType<typeof createLocalStorageManager> = {
    type: 'localStorage',
    ssr: false,
    get: () => 'dark',
    set: () => {},
};
