import React from "react";
import { HStack, Switch, SwitchProps, Text } from "@chakra-ui/react";
import useAppColors from "../../hooks/colors";

interface FBSwitchProps extends SwitchProps {
    typ: string;
    left?: string;
    right?: string;
}

const FBSwitch: React.FC<FBSwitchProps> = ({
    typ, left, right, ...props
}) => {
    const colors = useAppColors();
    return (
        <HStack>
            <Text>
                {left}
            </Text>
            <Switch 
                borderRadius={15}
                sx={{
                    ".chakra-switch__track": {
                        bg: colors[typ+"Quarter"],
                    }
                }}
                _checked={
                    {
                        bg: colors[typ],
                        borderColor: colors[typ],
                    }
                }
                {...props}
            />
            <Text>
                {right}
            </Text>
        </HStack>
    )
}

export default FBSwitch;