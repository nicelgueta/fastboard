import React from 'react';
import { HStack, Box, Text } from '@chakra-ui/react';
import useAppColors from '../hooks/useAppColors';

interface ConnectionBadgeProps {
    connected: boolean;
    /** e.g. the linked widget's name - shown next to the status word. */
    label?: string;
}

/**
 * Small dot + text used by the table and editor widgets to show their 1:1
 * link status to each other (see useEditorLinks in store/hooks.ts).
 */
const ConnectionBadge: React.FC<ConnectionBadgeProps> = ({ connected, label }) => {
    const [colors] = useAppColors();
    const dotColor = connected ? colors.success : colors.foreQuarter;
    const textColor = connected ? colors.success : colors.foreHalf;

    return (
        // minW 0 + truncation: in a narrow toolbar the status gives way rather than overflowing
        <HStack spacing={1.5} minW={0}>
            <Box w="8px" h="8px" borderRadius="full" bg={dotColor} flexShrink={0} />
            <Text fontSize="xs" color={textColor} noOfLines={1}>
                {connected ? `Connected${label ? ` to ${label}` : ''}` : 'Disconnected'}
            </Text>
        </HStack>
    );
};

export default ConnectionBadge;
