import React from "react";
import { Input, InputProps } from "@chakra-ui/react";
import useAppColors from "../hooks/colors";
import useInputColors from "../hooks/input-styles";

interface FBInputProps extends InputProps {
    typ?: "info" | "warning" | "success" | "fail";
}

const FBInput: React.FC<FBInputProps> = ({
    typ, ...props
}) => {
    const colors = useAppColors();
    
    return (
        <Input 
            w={"100%"}
            h={"100%"}
            padding={2}
            borderRadius={0}
            borderWidth={1}
            {...useInputColors(typ)}
            {...props}
        />
    )
};

export default FBInput;
