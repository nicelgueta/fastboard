import React from "react";
import { Input, InputProps } from "@chakra-ui/react";
import useAppColors from "../hooks/colors";

interface FBInputProps extends InputProps {
    status?: "info" | "warning" | "success" | "fail";
}

const FBInput: React.FC<FBInputProps> = ({
    status, ...props
}) => {
    const colors = useAppColors();
    const getColors = (status?: string): Object => {
        switch (status) {
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
    return (
        <Input 
            w={"100%"}
            h={"100%"}
            padding={2}
            borderRadius={0}
            borderWidth={1}
            {...getColors(status)}
            {...props}
        />
    )
};

export default FBInput;
