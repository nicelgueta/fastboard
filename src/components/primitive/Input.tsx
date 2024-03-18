import React from "react";
import { Input, InputProps } from "@chakra-ui/react";
import useAppColors from "../../hooks/colors";
import { componentType } from "../common";

interface FBInputProps extends InputProps {
    typ: componentType,
    setValue?: (value: string) => void;

}

const FBInput: React.FC<FBInputProps> = ({
    typ, setValue, ...props
}) => {
    const colors = useAppColors();
    
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
            padding={2}
            borderRadius={0}
            borderWidth={1}
            onChange={setValue ? (e) => setValue(e.target.value): props.onChange}
            {...props}
        />
    )
};

export default FBInput;
