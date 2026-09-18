import React from 'react';
import { IconButton, IconButtonProps } from '@chakra-ui/react';
import useAppColors, { RADIUS } from '../../hooks/useAppColors';
import { componentType } from '../../interfaces';

interface IconBuProps extends IconButtonProps {
    typ?: componentType;
    onClick: () => void;
}

const FBIconButton: React.FC<IconBuProps> = ({ typ, onClick, children, ...props }) => {
    const [colors] = useAppColors();
    typ = typ || "info";
    return (
        <IconButton
            bg={props.variant === "outline" ? colors.bgHalf : colors[typ+"Half"]}
            textColor={colors.fore}
            borderColor={colors[typ+"Half"]}
            borderRadius={RADIUS.md}
            borderWidth={1}
            _hover={{
                bg: props.variant === "outline" ? colors[typ+"Quarter"] : colors[typ+"3Quarter"],
            }}
            _active={{
                bg: colors[typ+"3Quarter"],
            }}
            {...props}
            onClick={onClick}
        />
    );
};

export default FBIconButton;
