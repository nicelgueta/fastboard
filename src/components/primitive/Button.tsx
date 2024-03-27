import React from 'react';
import { Button, ButtonProps } from '@chakra-ui/react';
import useAppColors from '../../hooks/useAppColors';

import { componentType } from '../../interfaces';

export interface FBButtonProps extends ButtonProps {
    typ?: componentType;
    onClick?: () => void;
    children?: React.ReactNode;
    isOutline?: boolean;
}

const FBButton: React.FC<FBButtonProps> = ({ typ, onClick, isOutline, children, ...props }) => {
    const [colors] = useAppColors();
    typ = typ || "info";
    return (
        <Button
            bg={props.variant === "outline" ? colors.bgHalf : colors[typ+"Half"]}
            textColor={colors.fore}
            borderColor={colors[typ+"Half"]}
            borderRadius={0}
            borderWidth={1}
            _hover={{
                bg: props.variant === "outline" ? colors[typ+"Quarter"] : colors[typ+"3Quarter"],
            }}
            {...props}
            onClick={onClick}
        >
            {children}
        </Button>
    );
};

export default FBButton;
