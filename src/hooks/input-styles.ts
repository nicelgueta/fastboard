import useAppColors from "./colors";

const useInputColors = (typ?: string): Object => {
    const colors = useAppColors();
    switch (typ) {
        case "info":
            return {
                borderColor: colors.foreActiveHalf,
                _hover: {
                    borderColor: colors.foreActive,
                },
                _focusVisible: {
                    borderColor: colors.foreActive,
                    bg: colors.foreActiveBarely
                }
            };
        case "warning":
            return {
                borderColor: colors.warningHalf,
                _hover: {
                    borderColor: colors.warning,
                },
                _focusVisible: {
                    borderColor: colors.warning,
                    bg: colors.warningBarely
                }
            };
        case "success":
            return {
                borderColor: colors.successHalf,
                _hover: {
                    borderColor: colors.success,
                },
                _focusVisible: {
                    borderColor: colors.success,
                    bg: colors.successBarely
                }
            };
        case "fail":
            return {
                borderColor: colors.failHalf,
                _hover: {
                    borderColor: colors.fail,
                },
                _focusVisible: {
                    borderColor: colors.fail,
                    bg: colors.failBarely
                }
            };
        default:
            return {
                borderColor: colors.foreActiveHalf,
                _hover: {
                    borderColor: colors.foreActive,
                },
                _focusVisible: {
                    borderColor: colors.foreActive,
                    bg: colors.foreActiveBarely
                }
            };
    
    }
}

export default useInputColors;