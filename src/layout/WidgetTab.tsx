import React from 'react';
import { Box, HStack, Input, Text } from '@chakra-ui/react';
import { MdClose } from 'react-icons/md';
import { IDockviewPanelHeaderProps } from 'dockview-react';
import useAppColors from '../hooks/useAppColors';
import { useWidgetStore } from '../store/widgetStore';

/**
 * A widget's tab. Replaces dockview's default tab so the title can be renamed
 * in place by double-clicking it, rather than only through the right-click
 * menu's window.prompt().
 *
 * Names are unique across the board (see uniqueWidgetName in Main.tsx), so a
 * rename that collides is rejected and the input stays open.
 */
const WidgetTab: React.FC<IDockviewPanelHeaderProps> = (props) => {
    const wKey = props.api.id;
    const [colors] = useAppColors();
    const widgets = useWidgetStore((s) => s.widgets);
    const rename = useWidgetStore((s) => s.rename);
    const record = widgets[wKey];
    const title = record?.name ?? props.api.title ?? wKey;

    const [editing, setEditing] = React.useState(false);
    const [draft, setDraft] = React.useState(title);
    const [invalid, setInvalid] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (editing) {
            setDraft(title);
            setInvalid(false);
            const t = setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 0);
            return () => clearTimeout(t);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editing]);

    const commit = () => {
        const next = draft.trim();
        if (!next || next === title) {
            setEditing(false);
            return;
        }
        const taken = Object.values(widgets).some((w) => w.wKey !== wKey && w.name === next);
        if (taken) {
            setInvalid(true);
            return;
        }
        rename(wKey, next);
        props.api.setTitle(next);
        setEditing(false);
    };

    return (
        <HStack
            spacing={1}
            px={2}
            h="100%"
            minW={0}
            maxW="240px"
            bg={props.api.isActive ? colors.bg : 'transparent'}
            borderBottomWidth={props.api.isActive ? 2 : 0}
            borderBottomColor={colors.info}
            onDoubleClick={(e) => {
                e.stopPropagation();
                setEditing(true);
            }}
        >
            {editing ? (
                <Input
                    ref={inputRef}
                    size="xs"
                    value={draft}
                    onChange={(e) => { setDraft(e.target.value); setInvalid(false); }}
                    onBlur={commit}
                    // dockview listens for drag/keys on the tab strip - keep the
                    // edit interaction entirely inside this input.
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') commit();
                        if (e.key === 'Escape') setEditing(false);
                    }}
                    borderRadius="sm"
                    borderColor={invalid ? colors.fail : colors.borderStrong}
                    bg={colors.surfaceAlt}
                    color={colors.fore}
                    w="150px"
                    title={invalid ? 'Another widget already has that name' : undefined}
                />
            ) : (
                <Text
                    fontSize="xs"
                    noOfLines={1}
                    color={props.api.isActive ? colors.fore : colors.foreHalf}
                    title={`${title} — double-click to rename`}
                >
                    {title}
                </Text>
            )}
            <Box
                as="span"
                aria-label={`close-${title}`}
                display="flex"
                alignItems="center"
                color={colors.foreHalf}
                borderRadius="sm"
                _hover={{ color: colors.fore, bg: colors.surfaceSubtle }}
                onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
                onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    props.api.close();
                }}
            >
                <MdClose size={13} />
            </Box>
        </HStack>
    );
};

export default WidgetTab;
