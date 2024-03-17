import React from 'react';
import { IconButton, IconButtonProps } from '@chakra-ui/react';
import useAppColors from '../hooks/colors';

export type bType = 'success' | 'warning' | 'fail' | 'action';

interface IconBuProps extends IconButtonProps {
    bType: bType;
    onClick: () => void;
}

const IconBu: React.FC<IconBuProps> = ({ bType, onClick, children, ...props }) => {
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
            bg: colors.foreActive3Quarter,
            textColor: colors.fore,
            borderColor: colors.foreActive,
            borderRadius: 0,
            _hover: {
                bg: colors.foreActive,
                textColor: colors.fore,
                borderColor: colors.fore,
            },
        },
    };

    return (
        <IconButton
            {...buttonConfigs[bType]}
            {...props}
            onClick={onClick}
        />
    );
};

export default IconBu;
