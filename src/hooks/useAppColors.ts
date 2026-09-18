import React from 'react';
import { useColorMode } from '@chakra-ui/color-mode';
import useKvStore from './useKvStore';

export interface BaseColors {
    bgDark: string;
    bgLight: string;
    success: string;
    success3Quarter: string;
    successHalf: string;
    successQuarter: string;
    successBarely: string;
    successLight: string;
    successDark: string;
    fail: string;
    fail3Quarter: string;
    failHalf: string;
    failQuarter: string;
    failBarely: string;
    failLight: string;
    failDark: string;
    warning: string;
    warning3Quarter: string;
    warningHalf: string;
    warningQuarter: string;
    warningBarely: string;
    warningLight: string;
    warningDark: string;

}
export interface Colors extends BaseColors {
    schemeName: string;
    bg: string;
    bg3Quarter: string;
    bgHalf: string;
    bgQuarter: string;
    fore: string;
    fore3Quarter: string;
    foreHalf: string;
    foreQuarter: string;
    foreLight: string;
    foreDark: string;
    foreBarely: string;
    info: string;
    info3Quarter: string;
    infoHalf: string;
    infoQuarter: string;
    infoBarely: string;
    infoLight: string;
    infoDark: string;
}

const colors: BaseColors = {
    bgDark: "rgba(22, 22, 33, 1)",
    bgLight: "rgba(247, 247, 247, 1)",
    success: "rgba(66, 199, 136, 1)",
    success3Quarter: "rgba(66, 199, 136, 0.75)",
    successHalf: "rgba(66, 199, 136, 0.5)",
    successQuarter: "rgba(66, 199, 136, 0.25)",
    successBarely: "rgba(66, 199, 136, 0.05)",
    successLight: "rgba(95, 201, 151, 1)",
    successDark: "rgba(26, 93, 49, 1)",
    fail: "rgba(227, 14, 42, 1)",
    fail3Quarter: "rgba(227, 14, 42, 0.75)",
    failHalf: "rgba(227, 14, 42, 0.5)",
    failQuarter: "rgba(227, 14, 42, 0.25)",
    failBarely: "rgba(227, 14, 42, 0.05)",
    failLight: "rgba(222, 84, 102, 1)",
    failDark: "rgba(93, 26, 26, 1)",
    warning: "rgba(207, 118, 23, 1)",
    warning3Quarter: "rgba(207, 118, 23, 0.75)",
    warningHalf: "rgba(207, 118, 23, 0.5)",
    warningQuarter: "rgba(207, 118, 23, 0.25)",
    warningBarely: "rgba(207, 118, 23, 0.05)",
    warningLight: "rgba(224, 163, 96, 1)",
    warningDark: "rgba(93, 66, 26, 1)",
};

// Selectable accent colors, expressed as plain RGB so both color-mode
// branches can build the same *kind* of value (rgba literals) instead of
// dark building Chakra scale-token strings ("yellow.400") while light used
// hard-coded rgba - see PLAN.md Phase 1 step 2. Keys are what gets persisted
// and shown as the accent picker.
export const ACCENT_PALETTE: Record<string, [number, number, number]> = {
    yellow: [214, 158, 46],
    orange: [221, 107, 32],
    purple: [128, 90, 213],
    blue: [66, 153, 225],
    teal: [56, 178, 172],
    green: [72, 187, 120],
    pink: [213, 63, 140],
    red: [229, 62, 62],
    cyan: [14, 165, 233],
};
const DEFAULT_ACCENT = "yellow";

const mix = (c: [number, number, number], target: [number, number, number], amount: number): [number, number, number] => [
    Math.round(c[0] + (target[0] - c[0]) * amount),
    Math.round(c[1] + (target[1] - c[1]) * amount),
    Math.round(c[2] + (target[2] - c[2]) * amount),
];
const rgba = (c: [number, number, number], a: number) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

const buildInfoVariants = (accentName: string) => {
    const base = ACCENT_PALETTE[accentName] || ACCENT_PALETTE[DEFAULT_ACCENT];
    const lightened = mix(base, [255, 255, 255], 0.35);
    const darkened = mix(base, [0, 0, 0], 0.35);
    return {
        info: rgba(base, 1),
        info3Quarter: rgba(base, 0.75),
        infoHalf: rgba(base, 0.5),
        infoQuarter: rgba(base, 0.25),
        infoBarely: rgba(base, 0.08),
        infoLight: rgba(lightened, 1),
        infoDark: rgba(darkened, 1),
    };
};

// --- Accent color state --------------------------------------------------
// Accent color used to live on a module-level mutable object (`mainConfig`)
// that `setMainInfoColor` mutated in place. Mutating it never triggered a
// React re-render, so changing the accent visibly did nothing. It now lives
// in real React state behind a context, provided once at the app root
// (see AppearanceProvider / FastBoard.tsx) and persisted via
// useKvStore('appearance') so it survives a reload.
interface AccentColorContextValue {
    accentColor: string;
    setAccentColor: (color: string) => void;
}
const AccentColorContext = React.createContext<AccentColorContextValue | undefined>(undefined);

export const AppearanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { get, set } = useKvStore('appearance');
    const [accentColor, setAccentColorState] = React.useState<string>(() => {
        const stored = get('accentColor');
        return (typeof stored === 'string' && ACCENT_PALETTE[stored]) ? stored : DEFAULT_ACCENT;
    });

    const setAccentColor = React.useCallback((color: string) => {
        const next = ACCENT_PALETTE[color] ? color : DEFAULT_ACCENT;
        setAccentColorState(next);
        set('accentColor', next);
    }, [set]);

    const value = React.useMemo(() => ({ accentColor, setAccentColor }), [accentColor, setAccentColor]);

    return React.createElement(AccentColorContext.Provider, { value }, children);
};

const useAppColors = (): [Colors, (c: string) => void] => {
    const { colorMode } = useColorMode();
    const accentCtx = React.useContext(AccentColorContext);
    const accentColor = accentCtx?.accentColor || DEFAULT_ACCENT;
    const setMainInfoColor = accentCtx?.setAccentColor || (() => {});
    const infoVariants = buildInfoVariants(accentColor);

    if (colorMode === "light") {
        let finalColors: Colors = {
            ...colors,
            schemeName: accentColor,
            bg: "rgba(247, 247, 247, 1)",
            bg3Quarter: "rgba(247, 247, 247, 0.9)",
            bgHalf: "rgba(247, 247, 247, 0.5)",
            bgQuarter: "rgba(247, 247, 247, 0.25)",
            fore: "rgba(65, 61, 133, 1)",
            fore3Quarter: "rgba(65, 61, 133, 0.75)",
            foreHalf: "rgba(65, 61, 133, 0.5)",
            foreQuarter: "rgba(65, 61, 133, 0.25)",
            foreBarely: "rgba(65, 61, 133, 0.05)",
            foreLight: "rgba(125, 121, 212, 1)",
            foreDark: "rgba(35, 32, 79, 1)",
            ...infoVariants,
        };
        return [finalColors, setMainInfoColor];
    } else {
        let finalColors: Colors = {
            ...colors,
            schemeName: accentColor,
            bg: "rgba(31,41,54,1)",//22, 22, 33, 1)",
            bg3Quarter: "rgba(22, 22, 33, 0.75)",
            bgHalf: "rgba(22, 22, 33, 0.5)",
            bgQuarter: "rgba(22, 22, 33, 0.25)",
            fore: "rgba(255, 255, 252, 1)",
            fore3Quarter: "rgba(255, 255, 252, 0.75)",
            foreHalf: "rgba(255, 255, 252, 0.5)",
            foreQuarter: "rgba(255, 255, 252, 0.25)",
            foreBarely: "rgba(255, 255, 252, 0.05)",
            foreLight: "rgba(245, 181, 98, 1)",
            foreDark: "rgba(186, 117, 28, 1)",
            ...infoVariants,
        };
        return [finalColors, setMainInfoColor];
    }
};

export default useAppColors;
