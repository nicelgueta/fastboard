import React from 'react';
import { Button, ButtonProps } from '@chakra-ui/react';
import useAppColors from '../../hooks/colors';

import { componentType } from '../common';

interface BuProps extends ButtonProps {
    typ: componentType;
    onClick: () => void;
    children: React.ReactNode;
}

const Bu: React.FC<BuProps> = ({ typ, onClick, children, ...props }) => {
    const colors = useAppColors();

    return (
        <Button
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
        >
            {children}
        </Button>
    );
};

export default Bu;
