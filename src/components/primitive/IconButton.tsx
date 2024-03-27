import React from 'react';
import { IconButton, IconButtonProps } from '@chakra-ui/react';
import useAppColors from '../../hooks/useAppColors';
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
            bg={props.variant === "outline" ? colors.bg : colors[typ+"3Quarter"]}
            textColor={props.variant === "outline" ? colors[typ] : colors.fore}
            borderColor={colors[typ]}
            borderRadius={0}
            borderWidth={1}
            _hover={{
                bg: colors[typ],
                textColor: colors.fore
            }}
            _active={{
                bg: colors[typ],
                textColor: colors.fore
            }}
            {...props}
            onClick={onClick}
        />
    );
};

export default FBIconButton;
