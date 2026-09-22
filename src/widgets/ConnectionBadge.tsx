import React from 'react';
import { HStack, Box, Text, Tooltip } from '@chakra-ui/react';
import useAppColors from '../hooks/useAppColors';

interface ConnectionBadgeProps {
    connected: boolean;
    /** e.g. the linked widget's name - shown next to the status word. */
    label?: string;
    /**
     * Deliberately not linked to anything (e.g. the editor's raw mode), as
     * opposed to a link that broke - shown in place of "Disconnected".
     */
    raw?: boolean;
    /**
     * One-liner explaining what this status means here - callers know their
     * own semantics (an editor's "Connected" isn't a table's), so this isn't
     * inferred. Shown as a hover tooltip; omit for no tooltip.
     */
    hint?: string;
}

/**
 * Small dot + text used by the table and editor widgets to show their 1:1
 * link status to each other (see useEditorLinks in store/hooks.ts).
 */
const ConnectionBadge: React.FC<ConnectionBadgeProps> = ({ connected, label, raw, hint }) => {
    const [colors] = useAppColors();
    const dotColor = connected ? colors.success : raw ? colors.warning : colors.foreQuarter;
    const textColor = connected ? colors.success : raw ? colors.warning : colors.foreHalf;
    const text = connected ? `Connected${label ? ` to ${label}` : ''}` : raw ? 'Raw output mode' : 'Disconnected';

    return (
        <Tooltip label={hint} isDisabled={!hint} hasArrow placement="bottom" openDelay={300}>
            {/* minW 0 + truncation: in a narrow toolbar the status gives way rather than overflowing */}
            <HStack spacing={1.5} minW={0}>
                <Box w="8px" h="8px" borderRadius="full" bg={dotColor} flexShrink={0} />
                <Text fontSize="xs" color={textColor} noOfLines={1}>
                    {text}
                </Text>
            </HStack>
        </Tooltip>
    );
};

export default ConnectionBadge;
