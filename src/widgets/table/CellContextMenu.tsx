import React from 'react';
import { Box, Button, Divider, Text } from '@chakra-ui/react';
import useAppColors from '../../hooks/useAppColors';

export interface CellMenuAction {
    label: string;
    /** Hint shown on the right, e.g. the format. */
    hint?: string;
    onSelect: () => void;
}

interface CellContextMenuProps {
    /** Position in the coordinate space of the nearest positioned ancestor. */
    x: number;
    y: number;
    /** Sections separated by dividers. */
    sections: CellMenuAction[][];
    onClose: () => void;
}

/**
 * Right-click menu for a grid cell. ag-grid's own context menu is an
 * Enterprise feature, so this is a small stand-in. It renders inside the widget
 * (position: absolute) rather than in a body-level portal, so it also works
 * when the group is popped out into another window.
 */
const CellContextMenu: React.FC<CellContextMenuProps> = ({ x, y, sections, onClose }) => {
    const [colors] = useAppColors();
    const ref = React.useRef<HTMLDivElement>(null);
    const [pos, setPos] = React.useState({ x, y });

    // Keep the menu inside its container: flip/shift once its size is known.
    React.useLayoutEffect(() => {
        const el = ref.current;
        const parent = el?.offsetParent as HTMLElement | null;
        if (!el || !parent) return;
        setPos({
            x: Math.max(0, Math.min(x, parent.clientWidth - el.offsetWidth - 4)),
            y: Math.max(0, Math.min(y, parent.clientHeight - el.offsetHeight - 4)),
        });
    }, [x, y, sections]);

    React.useEffect(() => {
        const doc = ref.current?.ownerDocument ?? document;
        const win = doc.defaultView ?? window;
        const onDown = (e: Event) => {
            if (!ref.current?.contains(e.target as Node)) onClose();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        doc.addEventListener('mousedown', onDown, true);
        doc.addEventListener('keydown', onKey, true);
        // scrolling the grid would leave the menu pointing at the wrong cell
        doc.addEventListener('wheel', onClose, true);
        win.addEventListener('blur', onClose);
        return () => {
            doc.removeEventListener('mousedown', onDown, true);
            doc.removeEventListener('keydown', onKey, true);
            doc.removeEventListener('wheel', onClose, true);
            win.removeEventListener('blur', onClose);
        };
    }, [onClose]);

    return (
        <Box
            ref={ref}
            role="menu"
            position="absolute"
            left={`${pos.x}px`}
            top={`${pos.y}px`}
            zIndex={20}
            minW="190px"
            py={1}
            bg={colors.surfaceAlt}
            borderWidth={1}
            borderColor={colors.borderStrong}
            borderRadius="md"
            boxShadow="lg"
            onContextMenu={(e) => e.preventDefault()}
        >
            {sections.map((items, si) => (
                <React.Fragment key={si}>
                    {si > 0 ? <Divider my={1} borderColor={colors.border} /> : null}
                    {items.map((item) => (
                        <Button
                            key={`${item.label}-${item.hint ?? ""}`}
                            role="menuitem"
                            variant="ghost"
                            size="sm"
                            w="100%"
                            justifyContent="space-between"
                            fontWeight={400}
                            borderRadius={0}
                            color={colors.fore}
                            _hover={{ bg: colors.infoQuarter }}
                            onClick={() => {
                                item.onSelect();
                                onClose();
                            }}
                        >
                            <Text as="span" fontSize="sm">{item.label}</Text>
                            {item.hint ? <Text as="span" fontSize="xs" color={colors.foreHalf} ml={4}>{item.hint}</Text> : null}
                        </Button>
                    ))}
                </React.Fragment>
            ))}
        </Box>
    );
};

export default CellContextMenu;
