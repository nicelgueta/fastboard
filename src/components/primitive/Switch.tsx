import React from "react";
import { HStack, Switch, Text, Box, Center } from "@chakra-ui/react";
import useAppColors from "../../hooks/useAppColors";

interface FBSwitchProps {
    typ?: string;
    left?: string;
    right?: string;
    setValue?: (value: boolean) => void;
    value?: boolean;
    isCenter?: boolean;
}

const FBSwitch: React.FC<FBSwitchProps> = ({
    typ, left, right, setValue, value, isCenter, ...props
}) => {
    const [colors] = useAppColors();
    typ = typ || "info";
    const Container = isCenter ? Center : Box 
    return (
        <Container>
            <HStack>
                <Text>
                    {left}
                </Text>
                <Switch 
                    borderRadius={15}
                    sx={{
                        ".chakra-switch__track": {
                            bg: colors.foreQuarter,
                        }
                    }}
                    _checked={
                        {
                            bg: colors[typ],
                            borderColor: colors[typ],
                        }
                    }
                    isChecked={value}
                    {...props}
                    onChange={setValue ? (e)=>setValue(e.target.checked):undefined}
                />

                <Text>
                    {right}
                </Text>
            </HStack>
        </Container>
    )
}

export default FBSwitch;