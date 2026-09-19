import React from 'react';
import { Box, Text } from '@chakra-ui/react';
import { DockviewApi, DockviewGroupPanel } from 'dockview-react';
import useAppColors from '../hooks/useAppColors';

/** Where a newly added widget docks, relative to a group or the whole board. */
export type DockDirection = 'above' | 'below' | 'left' | 'right' | 'within';

/** Where a widget being placed will land: a side of one group, or of the whole board. */
export interface PlacementTarget {
    direction: DockDirection;
    /** Undefined means the whole board (the widget is docked at the outer edge). */
    group?: DockviewGroupPanel;
}

interface Rect { left: number; top: number; width: number; height: number }

interface Hit extends PlacementTarget {
    rect: Rect;
}

// Cursor within this many px of the outer edge of the board docks against the
// whole board rather than the group underneath.
const BOARD_EDGE_PX = 28;
// The middle of a group (this fraction of each side) means "as another tab".
const CENTER_FRACTION = 0.5;

const toRect = (r: DOMRect): Rect => ({ left: r.left, top: r.top, width: r.width, height: r.height });

/** The half (or, for 'within', all) of `r` that a widget dropped in `direction` will occupy. */
const zoneRect = (r: Rect, direction: DockDirection): Rect => {
    switch (direction) {
        case 'above': return { ...r, height: r.height / 2 };
        case 'below': return { ...r, top: r.top + r.height / 2, height: r.height / 2 };
        case 'left': return { ...r, width: r.width / 2 };
        case 'right': return { ...r, left: r.left + r.width / 2, width: r.width / 2 };
        default: return r;
    }
};

const hitTest = (api: DockviewApi, x: number, y: number): Hit | null => {
    // Only groups in the main grid can be split; floating/popout groups are out of scope.
    const groups = api.groups.filter((g) => g.api.location.type === 'grid');
    const rects = groups.map((g) => ({ g, r: toRect(g.element.getBoundingClientRect()) }));
    if (rects.length === 0) return null;

    const board = rects.reduce(
        (b, { r }) => ({
            left: Math.min(b.left, r.left),
            top: Math.min(b.top, r.top),
            right: Math.max(b.right, r.left + r.width),
            bottom: Math.max(b.bottom, r.top + r.height),
        }),
        { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
    );
    const boardRect: Rect = {
        left: board.left,
        top: board.top,
        width: board.right - board.left,
        height: board.bottom - board.top,
    };
    if (x < board.left || x > board.right || y < board.top || y > board.bottom) return null;

    const edge = (direction: DockDirection): Hit => {
        const strip = { above: 'height', below: 'height', left: 'width', right: 'width' } as const;
        const full = zoneRect(boardRect, direction);
        // Preview a slimmer strip than a half-board so it reads as "the edge".
        const size = strip[direction as keyof typeof strip];
        const scaled = { ...full, [size]: Math.min(full[size], 220) } as Rect;
        if (direction === 'below') scaled.top = board.bottom - scaled.height;
        if (direction === 'right') scaled.left = board.right - scaled.width;
        return { direction, rect: scaled };
    };
    if (y - board.top < BOARD_EDGE_PX) return edge('above');
    if (board.bottom - y < BOARD_EDGE_PX) return edge('below');
    if (x - board.left < BOARD_EDGE_PX) return edge('left');
    if (board.right - x < BOARD_EDGE_PX) return edge('right');

    const hit = rects.find(({ r }) => x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height);
    if (!hit) return null;
    const { g, r } = hit;
    const fx = (x - r.left) / r.width;
    const fy = (y - r.top) / r.height;
    const lo = (1 - CENTER_FRACTION) / 2;
    let direction: DockDirection;
    if (fx > lo && fx < 1 - lo && fy > lo && fy < 1 - lo) {
        direction = 'within';
    } else {
        const dx = Math.min(fx, 1 - fx);
        const dy = Math.min(fy, 1 - fy);
        direction = dy < dx ? (fy < 0.5 ? 'above' : 'below') : (fx < 0.5 ? 'left' : 'right');
    }
    return { direction, group: g, rect: zoneRect(r, direction) };
};

interface PlacementOverlayProps {
    api: DockviewApi;
    widgetName: string;
    onPlace: (target: PlacementTarget) => void;
    onCancel: () => void;
}

/**
 * Placement mode for a newly added widget. The widget is "held" on the cursor:
 * a full-screen layer tracks the pointer, highlights where the widget would
 * dock (a side of the group underneath, its middle as a tab, or the outer edge
 * of the board), and a click drops it there. Escape cancels.
 *
 * dockview can't begin a tab drag programmatically (its drag sources are real
 * pointer/HTML5 drags), so the drop zones are computed here from the groups'
 * on-screen rects and the result handed back for `addPanel`.
 */
const PlacementOverlay: React.FC<PlacementOverlayProps> = ({ api, widgetName, onPlace, onCancel }) => {
    const [colors] = useAppColors();
    const [pointer, setPointer] = React.useState<{ x: number; y: number } | null>(null);
    const [hit, setHit] = React.useState<Hit | null>(null);

    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onCancel();
            }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [onCancel]);

    const onMove = (e: React.MouseEvent) => {
        setPointer({ x: e.clientX, y: e.clientY });
        setHit(hitTest(api, e.clientX, e.clientY));
    };

    return (
        <Box
            position="fixed"
            inset={0}
            zIndex={1500}
            cursor={hit ? 'grabbing' : 'not-allowed'}
            onMouseMove={onMove}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
                const target = hitTest(api, e.clientX, e.clientY);
                if (target) onPlace({ direction: target.direction, group: target.group });
            }}
            onContextMenu={(e) => { e.preventDefault(); onCancel(); }}
        >
            <Box
                position="absolute"
                top={3}
                left="50%"
                transform="translateX(-50%)"
                px={3}
                py={1}
                borderRadius="md"
                bg={colors.surfaceAlt}
                borderWidth={1}
                borderColor={colors.borderStrong}
                pointerEvents="none"
            >
                <Text fontSize="xs" color={colors.fore}>
                    Click to place <b>{widgetName}</b> · Esc to cancel
                </Text>
            </Box>
            {hit && (
                <Box
                    position="absolute"
                    left={`${hit.rect.left}px`}
                    top={`${hit.rect.top}px`}
                    w={`${hit.rect.width}px`}
                    h={`${hit.rect.height}px`}
                    bg={colors.infoHalf}
                    borderWidth={2}
                    borderColor={colors.info}
                    borderRadius="md"
                    pointerEvents="none"
                    transition="all 80ms ease-out"
                />
            )}
            {pointer && (
                <Box
                    position="absolute"
                    left={`${pointer.x + 14}px`}
                    top={`${pointer.y + 14}px`}
                    px={2}
                    py={0.5}
                    borderRadius="sm"
                    bg={colors.bg}
                    borderWidth={1}
                    borderColor={colors.info}
                    pointerEvents="none"
                    whiteSpace="nowrap"
                >
                    <Text fontSize="xs" color={colors.fore}>{widgetName}</Text>
                </Box>
            )}
        </Box>
    );
};

export default PlacementOverlay;
