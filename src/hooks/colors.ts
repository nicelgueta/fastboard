import { useColorMode } from '@chakra-ui/color-mode';

interface BaseColors {
    bgDark: string;
    bgLight: string;
    success: string;
    success3Quarter: string;
    successHalf: string;
    successQuarter: string;
    fail: string;
    fail3Quarter: string;
    failHalf: string;
    failQuarter: string;
    warning: string;
    warning3Quarter: string;
    warningHalf: string;
    warningQuarter: string;

}
interface Colors extends BaseColors {
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
    foreActive: string;
    foreActive3Quarter: string;
    foreActiveHalf: string;
    foreActiveQuarter: string;
    foreActiveBarely: string;
    foreActiveLight: string;
    foreActiveDark: string;
    scheme: string;
}

const useAppColors = (): Colors => {
    const { colorMode } = useColorMode();

    let colors: BaseColors = {
        bgDark: "rgba(22, 22, 33, 1)",
        bgLight: "rgba(247, 247, 247, 1)",
        success: "rgba(43, 186, 119, 1)",
        success3Quarter: "rgba(43, 186, 119, 0.75)",
        successHalf: "rgba(43, 186, 119, 0.5)",
        successQuarter: "rgba(43, 186, 119, 0.25)",
        fail: "rgba(227, 14, 42, 1)",
        fail3Quarter: "rgba(227, 14, 42, 0.75)",
        failHalf: "rgba(227, 14, 42, 0.5)",
        failQuarter: "rgba(227, 14, 42, 0.25)",
        warning: "rgba(207, 118, 23, 1)",
        warning3Quarter: "rgba(207, 118, 23, 0.75)",
        warningHalf: "rgba(207, 118, 23, 0.5)",
        warningQuarter: "rgba(207, 118, 23, 0.25)",
    };

    if (colorMode === "light") {
        let finalColors: Colors = {
            ...colors,
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
            foreActive: "rgba(126, 82, 191, 1)",
            foreActive3Quarter: "rgba(126, 82, 191, 0.75)",
            foreActiveHalf: "rgba(126, 82, 191, 0.5)",
            foreActiveQuarter: "rgba(126, 82, 191, 0.25)",
            foreActiveBarely: "rgba(126, 82, 191, 0.1)",
            foreActiveLight: "rgba(40, 130, 209, 1)",
            foreActiveDark: "rgba(15, 109, 191, 1)",
            scheme: "purple",
        };
        return finalColors;
    } else {
        let finalColors: Colors = {
            ...colors,
            bg: "rgba(22, 22, 33, 1)",
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
            foreActive: "rgba(128, 90, 213, 1)",
            foreActive3Quarter: "rgba(128, 90, 213, 0.75)",
            foreActiveHalf: "rgba(128, 90, 213, 0.5)",
            foreActiveQuarter: "rgba(128, 90, 213, 0.25)",
            foreActiveBarely: "rgba(128, 90, 213, 0.10)",
            foreActiveLight: "rgba(186, 156, 255, 1)",
            foreActiveDark: "rgba(21, 101, 117, 1)",
            scheme: "green",
        };
        return finalColors;
    }
};

export default useAppColors;
