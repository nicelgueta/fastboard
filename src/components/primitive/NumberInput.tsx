import React from "react";
import { 
    NumberInput, 
    NumberInputProps,
    NumberInputField,
    NumberInputStepper,
    NumberIncrementStepper,
    NumberDecrementStepper

} from "@chakra-ui/react";
import useAppColors from "../../hooks/useAppColors";
import { componentType } from "../../interfaces";

interface FBNumberInputProps extends NumberInputProps {
    typ?: componentType,
    setValue?: (value: number) => void;
}

const FBNumberInput: React.FC<FBNumberInputProps> = ({
    typ, setValue, ...props
}) => {
    const [colors] = useAppColors();
    typ = typ || "info";
    return (
        <NumberInput 
            w={"100%"}
            h={"100%"}
            onChange={setValue ? (_: string, valueAsNumber: number) => setValue(valueAsNumber): props.onChange}
            {...props}
        >
            <NumberInputField 
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
            />
            <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
            </NumberInputStepper>
        </NumberInput>
    )
};

export default FBNumberInput;
