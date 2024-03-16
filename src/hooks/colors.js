
import { useColorMode } from '@chakra-ui/color-mode';

const useAppColors = () => {

    const {colorMode, } = useColorMode();

    let colors = {};
    colors._bgDark = "rgba(22, 22, 33, 1)"//"rgba(3, 11, 45, 1)"
    colors._bgLight = "rgba(247, 247, 247, 1)"
    colors.success = "rgba(43, 186, 119, 1)"
    colors.success3Quarter = "rgba(43, 186, 119, 0.75)"
    colors.successHalf = "rgba(43, 186, 119, 0.5)"
    colors.successQuarter = "rgba(43, 186, 119, 0.25)"
    colors.fail = "rgba(227, 14, 42, 1)"
    colors.fail3Quarter = "rgba(227, 14, 42, 0.75)"
    colors.failHalf = "rgba(227, 14, 42, 0.5)"
    colors.failQuarter = "rgba(227, 14, 42, 0.25)"
    colors.warning = "rgba(207, 118, 23, 1)"
    colors.warning3Quarter = "rgba(207, 118, 23, 0.75)"
    colors.warningHalf = "rgba(207, 118, 23, 0.5)" 
    colors.warningQuarter = "rgba(207, 118, 23, 0.25)"

    if (colorMode === "light"){
        
        colors.bg = "rgba(247, 247, 247, 1)"//fafbff
        colors.bg3Quarter = "rgba(247, 247, 247, 0.9)"//fafbff
        colors.bgHalf = "rgba(247, 247, 247, 0.5)"//fafbff
        colors.bgQuarter = "rgba(247, 247, 247, 0.25)"//fafbff

        colors.fore = "rgba(65, 61, 133, 1)"
        colors.foreHalf = "rgba(65, 61, 133, 0.5)"
        colors.foreQuarter = "rgba(65, 61, 133, 0.25)"

        colors.foreLight = "rgba(125, 121, 212,1)"
        colors.foreDark = "rgba(35, 32, 79,1)"

        colors.foreActive = "rgba(126, 82, 191, 1)"
        colors.foreActive3Quarter = "rgba(126, 82, 191, 0.75)"
        colors.foreActiveHalf = "rgba(126, 82, 191, 0.5)"
        colors.foreActiveQuarter = "rgba(126, 82, 191, 0.25)"
        colors.foreActiveBarely = "rgba(126, 82, 191, 0.1)"
        colors.foreActive = "rgba(126, 82, 191, 1)"
        colors.foreActiveLight = "rgba(40, 130, 209,1)"
        colors.foreActiveDark = "rgba(15, 109, 191,1)"
        colors.scheme = "purple"

    } else {
        colors.bg = "rgba(22, 22, 33, 1)" //"rgba(29, 29, 29, 1)"//"rgba(6, 9, 28, 1)"//"#10131a"
        colors.bg3Quarter = "rgba(22, 22, 33, 0.75)"//"#10131a"
        colors.bgHalf = "rgba(22, 22, 33, 0.5)"//"#10131a"
        colors.bgQuarter = "rgba(22, 22, 33, 0.25)"//"#10131a"

        colors.fore = "rgba(255, 255, 252, 1)"
        colors.fore3Quarter = "rgba(255, 255, 252, 0.75)"
        colors.foreHalf = "rgba(255, 255, 252, 0.5)"
        colors.foreQuarter = "rgba(255, 255, 252, 0.25)"
        colors.fore15 = "rgba(255, 255, 252, 0.15)"
        colors.foreBarely = "rgba(255, 255, 252, 0.05)"

        colors.foreLight = "rgba(245, 181, 98, 1)"
        colors.foreDark = "rgba(186, 117, 28, 1)"

        colors.foreActive = "rgba(128, 90, 213, 1)"//"rgba(72, 187, 120, 1)"
        colors.foreActive3Quarter = "rgba(128, 90, 213, 0.75)"
        colors.foreActiveHalf = "rgba(128, 90, 213, 0.5)"//"rgba(72, 187, 120, 1)"
        colors.foreActiveQuarter = "rgba(128, 90, 213, 0.25)"//"rgba(72, 187, 120, 1)"
        colors.foreActiveBarely = "rgba(128, 90, 213, 0.10)"//"rgba(72, 187, 120, 1)"
        colors.foreActiveLight = "rgba(186, 156, 255, 1)"//"rgba(11, 197, 234, 1)"
        colors.foreActiveDark = "rgba(21, 101, 117, 1)"//"rgba(0, 163, 196, 1)"
        colors.scheme = "green"
    }
    return colors;
}
export default useAppColors;