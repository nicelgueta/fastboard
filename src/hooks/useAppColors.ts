import { useColorMode } from '@chakra-ui/color-mode';

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



const mainConfig = {
    mainInfoColor: "yellow",
    darkness: 4 as 2 | 3 | 4 | 5
}


const useAppColors = (): [Colors,(c: string) => void] => {
    const { colorMode } = useColorMode();
    const setMainInfoColor = (color: string) => {
        mainConfig.mainInfoColor = color;
    };
    if (colorMode === "light") {
        let finalColors: Colors = {
            ...colors,
            schemeName: mainConfig.mainInfoColor,
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
            info: "rgba(126, 82, 191, 1)",
            info3Quarter: "rgba(126, 82, 191, 0.75)",
            infoHalf: "rgba(126, 82, 191, 0.5)",
            infoQuarter: "rgba(126, 82, 191, 0.25)",
            infoBarely: "rgba(126, 82, 191, 0.1)",
            infoLight: "rgba(40, 130, 209, 1)",
            infoDark: "rgba(15, 109, 191, 1)",
        };
        return [finalColors, setMainInfoColor];
    } else {
        let finalColors: Colors = {
            ...colors,
            schemeName: mainConfig.mainInfoColor,
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
            info: `${mainConfig.mainInfoColor}.${(mainConfig.darkness*100)+0}`,//"rgba(128, 90, 213, 1)",
            info3Quarter: `${mainConfig.mainInfoColor}.${(mainConfig.darkness*100)+100}`,//"rgba(128, 90, 213, 0.75)",
            infoHalf: `${mainConfig.mainInfoColor}.${(mainConfig.darkness*100)+200}`,//"rgba(128, 90, 213, 0.5)",
            infoQuarter: `${mainConfig.mainInfoColor}.${(mainConfig.darkness*100)+300}`,//"rgba(128, 90, 213, 0.25)",
            infoBarely: `${mainConfig.mainInfoColor}.${(mainConfig.darkness*100)+400}`,//"rgba(128, 90, 213, 0.10)",
            infoLight: `${mainConfig.mainInfoColor}.${100}`,//"rgba(186, 156, 255, 1)",
            infoDark: `${mainConfig.mainInfoColor}.${900}`//"rgba(21, 101, 117, 1)",
        };
        return [finalColors, setMainInfoColor];
    }
};

export default useAppColors;
