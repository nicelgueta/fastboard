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

    const buttonConfigs: Record<string, Object> = {
        success: {
            bg: colors.success3Quarter,
            textColor: colors.fore,
            borderColor: colors.success,
            borderRadius: 0,
            borderWidth: 1,
            _hover: {
                bg: colors.success,
            },
        },
        warning: {
            bg: colors.warning3Quarter,
            textColor: colors.fore,
            borderColor: colors.warning,
            borderRadius: 0,
            _hover: {
                bg: colors.warning,
                textColor: colors.fore,
                borderColor: colors.fore,
            },
        },
        fail: {
            bg: colors.fail3Quarter,
            textColor: colors.fore,
            borderColor: colors.fail,
            borderRadius: 0,
            _hover: {
                bg: colors.fail,
                textColor: colors.fore,
                borderColor: colors.fore,
            },
        },
        action: {
            bg: colors.info3Quarter,
            textColor: colors.fore,
            borderColor: colors.info,
            borderRadius: 0,
            _hover: {
                bg: colors.info,
                textColor: colors.fore,
                borderColor: colors.fore,
            },
        },
    };

    return (
        <IconButton
            {...buttonConfigs[typ]}
            {...props}
            onClick={onClick}
        />
    );
};

export default FBIconButton;
