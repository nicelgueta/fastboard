import React from 'react';
import { HStack, IconButton, Tooltip } from '@chakra-ui/react';
import { MdFullscreen, MdFullscreenExit } from 'react-icons/md';
import { IDockviewHeaderActionsProps } from 'dockview-react';
import useAppColors from '../hooks/useAppColors';

// Rendered once per dockview group, pinned to the right of its tab strip.
// Group-level actions that mirror the tab context menu's window items, so
// they're one click away.
const GroupRightActions: React.FC<IDockviewHeaderActionsProps> = ({ group, containerApi }) => {
    const [colors] = useAppColors();
    const [maximized, setMaximized] = React.useState(() => group.api.isMaximized());

    // Maximizing another group (or restoring) changes this group's state too.
    React.useEffect(() => {
        setMaximized(group.api.isMaximized());
        const sub = containerApi.onDidMaximizedGroupChange(() => setMaximized(group.api.isMaximized()));
        return () => sub.dispose();
    }, [group, containerApi]);

    // Only grid groups can be maximized (floating/popout ones can't), unless
    // already maximized so it can always be undone.
    const canMaximize = maximized || group.api.location.type === 'grid';
    if (!canMaximize) return null;

    const toggle = () => (maximized ? group.api.exitMaximized() : group.api.maximize());

    return (
        <HStack h="100%" spacing={0} paddingRight={1} onMouseDown={(e) => e.stopPropagation()}>
            <Tooltip label={maximized ? 'Restore' : 'Maximize'} openDelay={400}>
                <IconButton
                    aria-label={maximized ? 'restore-group' : 'maximize-group'}
                    icon={maximized ? <MdFullscreenExit /> : <MdFullscreen />}
                    onClick={toggle}
                    size="xs"
                    variant="ghost"
                    color={colors.fore}
                    _hover={{ bg: colors.foreQuarter }}
                />
            </Tooltip>
        </HStack>
    );
};

export default GroupRightActions;
