import React from "react";
import { HStack, Switch, SwitchProps, Text } from "@chakra-ui/react";
import useAppColors from "../../hooks/colors";

interface FBSwitchProps {
    typ: string;
    left?: string;
    right?: string;
    setValue?: (value: boolean) => void;
    value?: boolean;
}

const FBSwitch: React.FC<FBSwitchProps> = ({
    typ, left, right, setValue, value, ...props
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
                isChecked={value}
                onChange={setValue ? (e)=>setValue(e.target.checked):undefined}
            />

            <Text>
                {right}
            </Text>
        </HStack>
    )
}

export default FBSwitch;