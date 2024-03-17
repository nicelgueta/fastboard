import React from "react";
import { 
    NumberInput, 
    NumberInputProps,
    NumberInputField,
    NumberInputStepper,
    NumberIncrementStepper,
    NumberDecrementStepper

} from "@chakra-ui/react";
import useAppColors from "../hooks/colors";
import { componentType } from "./common";

interface FBNumberInputProps extends NumberInputProps {
    typ: componentType
}

const FBNumberInput: React.FC<FBNumberInputProps> = ({
    typ, ...props
}) => {
    const colors = useAppColors();
    
    return (
        <NumberInput 
            w={"100%"}
            h={"100%"}
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
