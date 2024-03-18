import React from 'react';
import { IconButton, IconButtonProps } from '@chakra-ui/react';
import useAppColors from '../../hooks/colors';
import { componentType } from '../common';

interface IconBuProps extends IconButtonProps {
    typ: componentType;
    onClick: () => void;
}

const FBIconButton: React.FC<IconBuProps> = ({ typ, onClick, children, ...props }) => {
    const colors = useAppColors();

    return (
        <IconButton
            bg={colors[typ+"3Quarter"]}
            textColor={colors.fore}
            borderColor={colors[typ]}
            borderRadius={0}
            borderWidth={1}
            _hover={{
                bg: colors[typ],
            }}
            {...props}
            onClick={onClick}
        />
    );
};

export default FBIconButton;
