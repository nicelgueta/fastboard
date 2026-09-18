import React from 'react';
import {
    Box,
    Button,
    HStack,
    Input,
    Menu,
    MenuButton,
    MenuDivider,
    MenuItem,
    MenuList,
    Text,
} from '@chakra-ui/react';
import { MdExpandMore, MdCheck, MdDeleteOutline, MdSaveAlt, MdAdd, MdEdit } from 'react-icons/md';
import useAppColors from '../hooks/useAppColors';

export interface BoardMenuProps {
    boards: string[];
    currentBoard: string;
    dirty: boolean;
    onOpen: (key: string) => void;
    onSave: () => void;
    onSaveAs: () => void;
    onRename: () => void;
    onDelete: (key: string) => void;
    onNew: () => void;
}

/**
 * The board switcher: one control that names the board you are on and holds
 * every board action behind it.
 *
 * This replaces a dropdown plus three unlabelled icon buttons (save / save-as /
 * reset) sitting loose in the header - the same pattern a document-based app
 * uses, where the file name itself is the menu.
 */
const BoardMenu: React.FC<BoardMenuProps> = ({
    boards,
    currentBoard,
    dirty,
    onOpen,
    onSave,
    onSaveAs,
    onRename,
    onDelete,
    onNew,
}) => {
    const [colors] = useAppColors();
    const [query, setQuery] = React.useState('');
    const inputRef = React.useRef<HTMLInputElement>(null);

    const filtered = React.useMemo(() => {
        const q = query.trim().toLowerCase();
        const sorted = [...boards].sort((a, b) => a.localeCompare(b));
        return q ? sorted.filter((b) => b.toLowerCase().includes(q)) : sorted;
    }, [boards, query]);

    const itemStyle = {
        bg: 'transparent',
        _hover: { bg: colors.surfaceSubtle },
        _focus: { bg: colors.surfaceSubtle },
        fontSize: 'sm' as const,
    };

    return (
        <Menu onOpen={() => { setQuery(''); setTimeout(() => inputRef.current?.focus(), 0); }} autoSelect={false}>
            <MenuButton
                as={Button}
                size="sm"
                variant="ghost"
                rightIcon={<MdExpandMore />}
                borderRadius="md"
                borderWidth={1}
                borderColor="transparent"
                color={colors.fore}
                fontWeight={500}
                maxW="260px"
                _hover={{ bg: colors.surfaceSubtle, borderColor: colors.border }}
                _active={{ bg: colors.surfaceSubtle }}
            >
                <HStack spacing={2} minW={0}>
                    <Text noOfLines={1}>{currentBoard || 'Untitled board'}</Text>
                    {dirty ? (
                        // Quiet unsaved marker, the way an editor shows a dirty file.
                        <Box w="6px" h="6px" borderRadius="full" bg={colors.info} flexShrink={0} />
                    ) : null}
                </HStack>
            </MenuButton>

            <MenuList
                bg={colors.surfaceAlt}
                borderColor={colors.border}
                borderRadius="lg"
                minW="280px"
                zIndex={20}
                py={1}
            >
                <Box px={2} pb={1}>
                    <Input
                        ref={inputRef}
                        size="sm"
                        placeholder="Find a board..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        borderRadius="md"
                        borderColor={colors.border}
                        bg={colors.surface}
                        _hover={{ borderColor: colors.borderStrong }}
                        _focusVisible={{ borderColor: colors.info, boxShadow: 'none' }}
                    />
                </Box>

                <Box maxH="240px" overflowY="auto">
                    {filtered.length === 0 ? (
                        <Text px={3} py={2} fontSize="xs" color={colors.foreHalf}>
                            {boards.length === 0 ? 'No saved boards yet' : 'No matches'}
                        </Text>
                    ) : (
                        filtered.map((b) => (
                            <MenuItem
                                key={b}
                                {...itemStyle}
                                onClick={() => onOpen(b)}
                                icon={b === currentBoard ? <MdCheck /> : <Box w="1em" />}
                            >
                                <HStack justify="space-between" w="100%">
                                    <Text noOfLines={1}>{b}</Text>
                                    <Box
                                        as="span"
                                        aria-label={`delete-board-${b}`}
                                        color={colors.foreHalf}
                                        _hover={{ color: colors.fail }}
                                        onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation();
                                            onDelete(b);
                                        }}
                                    >
                                        <MdDeleteOutline />
                                    </Box>
                                </HStack>
                            </MenuItem>
                        ))
                    )}
                </Box>

                <MenuDivider borderColor={colors.border} />
                <MenuItem {...itemStyle} icon={<MdSaveAlt />} onClick={onSave} isDisabled={!currentBoard}>
                    Save
                </MenuItem>
                <MenuItem {...itemStyle} icon={<MdSaveAlt />} onClick={onSaveAs}>
                    Save as…
                </MenuItem>
                <MenuItem {...itemStyle} icon={<MdEdit />} onClick={onRename} isDisabled={!currentBoard}>
                    Rename…
                </MenuItem>
                <MenuDivider borderColor={colors.border} />
                <MenuItem {...itemStyle} icon={<MdAdd />} onClick={onNew}>
                    New board
                </MenuItem>
            </MenuList>
        </Menu>
    );
};

export default BoardMenu;
