import React from "react";
import { Center, Select, SelectProps } from "@chakra-ui/react";
import useAppColors from "../../hooks/colors";
import { componentType } from "../common";
import { SelectOption } from "../../interfaces"

export interface FBSelectProps extends SelectProps {
    typ: componentType;
    options: SelectOption[];
    setValue?: (value: string) => void;
}

const FBSelect: React.FC<FBSelectProps> = ({
    typ, options, setValue, ...props
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
                onChange={setValue ? (e) => setValue(e.target.value): props.onChange}
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
