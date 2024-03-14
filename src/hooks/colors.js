
import { useColorMode } from '@chakra-ui/color-mode';

const useAppColors = () => {

    const {colorMode, } = useColorMode();

    let colors = {};
    colors._bgDark = "rgba(3, 11, 45, 1)"
    colors._bgLight = "rgba(255, 255, 252, 1)"
    colors.success = "rgba(14, 227, 28, 1)"
    colors.fail = "rgba(227, 14, 42, 1)"

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

        colors.foreActive = "rgba(68, 124, 173,1)"
        colors.foreActiveLight = "rgba(40, 130, 209,1)"
        colors.foreActiveDark = "rgba(15, 109, 191,1)"
        colors.scheme = "purple"

    } else {
        colors.bg = "rgba(6, 9, 28, 1)"//"#10131a"
        colors.bg3Quarter = "rgba(6, 9, 28, 0.9)"//"#10131a"
        colors.bgHalf = "rgba(6, 9, 28, 0.5)"//"#10131a"
        colors.bgQuarter = "rgba(6, 9, 28, 0.25)"//"#10131a"

        colors.fore = "rgba(237, 198, 90, 1)"
        colors.foreHalf = "rgba(240, 160, 55, 0.5)"
        colors.foreQuarter = "rgba(240, 160, 55, 0.25)"

        colors.foreLight = "rgba(245, 181, 98, 1)"
        colors.foreDark = "rgba(186, 117, 28, 1)"

        colors.foreActive = "rgba(209, 255, 102, 1)"//"rgba(72, 187, 120, 1)"
        colors.foreActiveLight = "rgba(176, 233, 245, 1)"//"rgba(11, 197, 234, 1)"
        colors.foreActiveDark = "rgba(21, 101, 117, 1)"//"rgba(0, 163, 196, 1)"
        colors.scheme = "cyan"
    }
    return colors;
}
export default useAppColors;