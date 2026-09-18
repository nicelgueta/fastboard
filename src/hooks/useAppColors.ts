import React from 'react';
import { useColorMode } from '@chakra-ui/color-mode';
import useKvStore from './useKvStore';

/**
 * The app's design tokens.
 *
 * The accent is not just a button color - it tints the whole theme. Backgrounds,
 * surfaces, text and borders are all derived from the selected accent's hue, so
 * picking "teal" shifts the entire UI rather than recoloring a few buttons.
 *
 * Semantic colors (success/warning/fail/info) are deliberately muted rather than
 * fully saturated: the old palette used pure #E30E2A-style values that fought
 * with everything around them.
 */

type RGB = [number, number, number];

const mix = (c: RGB, target: RGB, amount: number): RGB => [
    Math.round(c[0] + (target[0] - c[0]) * amount),
    Math.round(c[1] + (target[1] - c[1]) * amount),
    Math.round(c[2] + (target[2] - c[2]) * amount),
];
const rgba = (c: RGB, a: number) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

const BLACK: RGB = [0, 0, 0];
const WHITE: RGB = [255, 255, 255];
/** Near-black / near-white anchors: never pure, so the tint stays visible. */
const INK: RGB = [17, 19, 24];
const PAPER: RGB = [252, 252, 253];

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

    /** Panel / card background, one step off the page background. */
    surface: string;
    /** A second elevation step - menus, popovers, modals. */
    surfaceAlt: string;
    /** Hover/stripe wash. */
    surfaceSubtle: string;
    /** Default hairline. Low contrast by design. */
    border: string;
    /** Emphasised border (focus, active). */
    borderStrong: string;
    /** Modal/overlay scrim. */
    overlay: string;
}

/** Corner radii. Nothing in the app should hard-code `borderRadius={0}` any more. */
export const RADIUS = {
    sm: '4px',
    md: '6px',
    lg: '10px',
    xl: '14px',
    full: '9999px',
} as const;

/** Muted semantic colors, shared across both color modes. */
const SEMANTIC: Record<'success' | 'fail' | 'warning', RGB> = {
    success: [72, 170, 125],
    fail: [201, 85, 92],
    warning: [199, 141, 74],
};

const semanticVariants = (name: 'success' | 'fail' | 'warning', dark: boolean) => {
    const base = SEMANTIC[name];
    return {
        [name]: rgba(base, 1),
        [`${name}3Quarter`]: rgba(base, 0.7),
        [`${name}Half`]: rgba(base, 0.45),
        [`${name}Quarter`]: rgba(base, 0.22),
        [`${name}Barely`]: rgba(base, 0.08),
        [`${name}Light`]: rgba(mix(base, WHITE, dark ? 0.3 : 0.15), 1),
        [`${name}Dark`]: rgba(mix(base, BLACK, dark ? 0.45 : 0.25), 1),
    };
};

const buildSemantic = (dark: boolean): BaseColors => ({
    bgDark: rgba(INK, 1),
    bgLight: rgba(PAPER, 1),
    ...semanticVariants('success', dark),
    ...semanticVariants('fail', dark),
    ...semanticVariants('warning', dark),
} as BaseColors);

/**
 * Selectable accents. Each one drives the entire theme, not just controls -
 * backgrounds and text are tinted toward the same hue.
 */
export const ACCENT_PALETTE: Record<string, RGB> = {
    amber: [214, 158, 46],
    orange: [214, 112, 58],
    rose: [201, 94, 128],
    violet: [140, 108, 214],
    indigo: [98, 116, 214],
    blue: [66, 146, 214],
    cyan: [56, 162, 178],
    teal: [56, 172, 152],
    green: [96, 168, 96],
    slate: [122, 132, 152],
};
const DEFAULT_ACCENT = 'teal';

const buildTheme = (accentName: string, dark: boolean): Colors => {
    const accent = ACCENT_PALETTE[accentName] || ACCENT_PALETTE[DEFAULT_ACCENT];

    // Tint the neutrals toward the accent hue. The mix amounts are what keep
    // this readable: heavy pull toward ink/paper, just enough accent to colour it.
    const bg = dark ? mix(accent, INK, 0.94) : mix(accent, PAPER, 0.95);
    const surface = dark ? mix(accent, INK, 0.88) : mix(accent, PAPER, 0.9);
    const surfaceAlt = dark ? mix(accent, INK, 0.83) : mix(accent, PAPER, 0.97);
    const fore = dark ? mix(accent, WHITE, 0.82) : mix(accent, INK, 0.84);

    return {
        ...buildSemantic(dark),
        schemeName: accentName,

        bg: rgba(bg, 1),
        bg3Quarter: rgba(bg, 0.75),
        bgHalf: rgba(bg, 0.55),
        bgQuarter: rgba(bg, 0.3),

        surface: rgba(surface, 1),
        surfaceAlt: rgba(surfaceAlt, 1),
        surfaceSubtle: rgba(accent, dark ? 0.06 : 0.05),
        border: rgba(accent, dark ? 0.18 : 0.16),
        borderStrong: rgba(accent, dark ? 0.42 : 0.38),
        overlay: dark ? 'rgba(8, 9, 12, 0.6)' : 'rgba(30, 32, 40, 0.35)',

        fore: rgba(fore, 1),
        fore3Quarter: rgba(fore, 0.72),
        foreHalf: rgba(fore, 0.52),
        foreQuarter: rgba(fore, 0.26),
        foreBarely: rgba(fore, 0.07),
        foreLight: rgba(mix(fore, WHITE, dark ? 0.2 : 0.45), 1),
        foreDark: rgba(mix(fore, BLACK, 0.4), 1),

        info: rgba(accent, 1),
        info3Quarter: rgba(accent, 0.7),
        infoHalf: rgba(accent, 0.45),
        infoQuarter: rgba(accent, 0.22),
        infoBarely: rgba(accent, 0.08),
        infoLight: rgba(mix(accent, WHITE, dark ? 0.32 : 0.18), 1),
        infoDark: rgba(mix(accent, BLACK, dark ? 0.45 : 0.25), 1),
    };
};

// --- Accent state ---------------------------------------------------------
interface AccentColorContextValue {
    accentColor: string;
    setAccentColor: (color: string) => void;
}
const AccentColorContext = React.createContext<AccentColorContextValue | undefined>(undefined);

export const AppearanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { get, set } = useKvStore('appearance');
    const [accentColor, setAccentColorState] = React.useState<string>(() => {
        const stored = get('accentColor');
        return typeof stored === 'string' && ACCENT_PALETTE[stored] ? stored : DEFAULT_ACCENT;
    });

    const setAccentColor = React.useCallback((color: string) => {
        const next = ACCENT_PALETTE[color] ? color : DEFAULT_ACCENT;
        setAccentColorState(next);
        set('accentColor', next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const value = React.useMemo(() => ({ accentColor, setAccentColor }), [accentColor, setAccentColor]);
    return React.createElement(AccentColorContext.Provider, { value }, children);
};

const useAppColors = (): [Colors, (c: string) => void] => {
    const { colorMode } = useColorMode();
    const accentCtx = React.useContext(AccentColorContext);
    const accentColor = accentCtx?.accentColor || DEFAULT_ACCENT;
    const setMainInfoColor = accentCtx?.setAccentColor || (() => {});
    const dark = colorMode !== 'light';

    const theme = React.useMemo(() => buildTheme(accentColor, dark), [accentColor, dark]);
    return [theme, setMainInfoColor];
};

export default useAppColors;
