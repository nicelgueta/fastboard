import React from 'react';
import { HStack, IconButton } from '@chakra-ui/react';
import { MdOpenInNew } from 'react-icons/md';
import { IDockviewHeaderActionsProps } from 'dockview-react';
import useAppColors from '../hooks/useAppColors';

// Rendered once per dockview group, pinned to the left of its tab strip
// (top-left of the group). Pops the whole group - tabs and all - out into
// its own browser window. Per-widget actions (settings, save as, rename,
// lock, close, ...) live on the tab's right-click menu instead, since a
// group can hold several tabs and this toolbar isn't scoped to just one.
const GroupHeaderActions: React.FC<IDockviewHeaderActionsProps> = ({ group, containerApi }) => {
    const [colors] = useAppColors();

    const popOut = () => {
        containerApi.addPopoutGroup(group);
    };

    return (
        <HStack h="100%" spacing={0} paddingLeft={1} onMouseDown={(e) => e.stopPropagation()}>
            <IconButton
                aria-label='popout-group'
                icon={<MdOpenInNew />}
                onClick={popOut}
                size="xs"
                variant="ghost"
                color={colors.fore}
                _hover={{ bg: colors.foreQuarter }}
            />
        </HStack>
    );
};

export default GroupHeaderActions;
