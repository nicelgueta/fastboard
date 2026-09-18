import { extendTheme, ThemeConfig } from '@chakra-ui/react';
import { createLocalStorageManager } from '@chakra-ui/color-mode';

const config: ThemeConfig = {
    initialColorMode: 'dark',
    useSystemColorMode: false,
};

const theme = extendTheme({ config });

export default theme;

// Real light/dark toggle, persisted to localStorage under its own key so it
// can't collide with anything else. A fresh profile (no stored value yet)
// still resolves to 'dark' via ThemeConfig.initialColorMode above, and
// ColorModeScript (see FastBoard.tsx) must be given the same key + initial
// value so there is no flash of the wrong theme on load.
export const colorModeManager: ReturnType<typeof createLocalStorageManager> =
    createLocalStorageManager('fastboard-color-mode');
