import React from "react";
import { Textarea , TextareaProps } from "@chakra-ui/react";
import useAppColors from "../../hooks/useAppColors";
import { componentType } from "../../interfaces";

interface FBTextareaProps extends TextareaProps {
    typ?: componentType,
    setValue?: (value: string) => void;

}

const FBTextarea: React.FC<FBTextareaProps> = ({
    typ, setValue, ...props
}) => {
    const [colors] = useAppColors();
    typ = typ || "info";
    return (
        <Textarea 
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

export default FBTextarea;
