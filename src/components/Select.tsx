import React from "react";
import { Box, Select, SelectProps } from "@chakra-ui/react";
import useAppColors from "../hooks/colors";

interface FBSelectProps extends SelectProps {
    typ?: "info" | "warning" | "success" | "fail";
    options: Option[];
}

interface Option {
    label: string;
    value: string;
}

const FBSelect: React.FC<FBSelectProps> = ({
    typ, options, ...props
}) => {
    const colors = useAppColors();
    const getColors = (typ?: string): Object => {
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
    const selectedOptionStyles = {
        bg: colors.bg, // Background color
        color: colors.fore, // Text color
        _hover: {
            bg: colors.foreActiveLight, // Hover background color
            color: colors.bg, // Hover text color
        },
    };
    return (
        <Select 
            w={"100%"}
            h={"100%"}
            variant={"outline"}
            borderRadius={0}
            borderWidth={1}
            sx={{
                "> option": {
                    bg: colors.bg,
                    color: colors.foreActiveLight,
                    borderRadius: 0,
                },
            }}
            {...getColors(typ)}
            {...props}
        >
            {
                options.map((option, index) => (
                <option 
                    key={index} 
                    value={option.value}
                >
                    {option.label}
                </option>
            ))}
        </Select>
    )
};

export default FBSelect;
