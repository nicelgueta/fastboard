import React from "react";
import { Center, Select, SelectProps } from "@chakra-ui/react";
import useAppColors, { RADIUS } from "../../hooks/useAppColors";
import { SelectOption, componentType } from "../../interfaces";

export interface FBSelectProps extends SelectProps {
    typ?: componentType;
    options: SelectOption[];
    setValue?: (value: string) => void;
    fillColor?: boolean;
}

const FBSelect: React.FC<FBSelectProps> = ({
    typ, options, setValue, fillColor,...props
}) => {
    const [colors] = useAppColors();
    typ = typ || "info";
    return (
        <Center
            w="100%"
            h={"100%"}
        >
            <Select
                variant={"outline"}
                borderRadius={RADIUS.md}
                borderWidth={1}
                textColor={colors.fore}
                borderColor={colors[typ+"Half"]}
                bg={fillColor ? colors[typ+"Dark"] : colors.surface}
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
