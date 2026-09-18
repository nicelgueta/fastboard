import React from "react";
import { Input, InputProps } from "@chakra-ui/react";
import useAppColors, { RADIUS } from "../../hooks/useAppColors";
import { componentType } from "../../interfaces";

interface FBInputProps extends InputProps {
    typ?: componentType,
    setValue?: (value: string) => void;
    fillColor?: boolean;

}

const FBInput: React.FC<FBInputProps> = ({
    typ, setValue, fillColor, ...props
}) => {
    const [colors] = useAppColors();
    typ = typ || "info";
    return (
        <Input 
            w={"100%"}
            h={"100%"}
            borderColor={colors[typ+"Half"]}
            _hover={{
                borderColor: colors[typ]
            }}
            _focusVisible={{
                borderColor: colors[typ],
                bg: colors[typ+"Barely"]
            }}
            bg={fillColor ? colors[typ+"Dark"] : undefined}
            padding={2}
            borderRadius={RADIUS.md}
            borderWidth={1}
            onChange={setValue ? (e) => setValue(e.target.value): props.onChange}
            {...props}
        />
    )
};

export default FBInput;
