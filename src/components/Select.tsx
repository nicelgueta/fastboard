import React from "react";
import { Center, Select, SelectProps } from "@chakra-ui/react";
import useAppColors from "../hooks/colors";
import { componentType } from "./common";

export interface FBSelectProps extends SelectProps {
    typ: componentType;
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
    return (
        <Center
            w="100%"
            h={"100%"}
        >
            <Select 
                variant={"outline"}
                // bg={colors[typ+"Barely"]}
                borderRadius={0}
                borderWidth={1}
                textColor={colors.fore}
                borderColor={colors[typ+"Half"]}
                _hover={{
                    borderColor: colors[typ],
                }}
                _focusVisible={{
                    borderColor: colors[typ],
                    bg: colors[typ+"Quarter"]
                }}
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
        </Center>
    )
};

export default FBSelect;
