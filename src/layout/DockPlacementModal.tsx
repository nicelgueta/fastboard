import React from 'react';
import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalCloseButton,
    ModalBody,
    Box,
    Text,
} from '@chakra-ui/react';
import { MdArrowUpward, MdArrowDownward, MdArrowBack, MdArrowForward, MdTab } from 'react-icons/md';
import useAppColors, { RADIUS } from '../hooks/useAppColors';
import { stopPropagation } from '../components/common';

/** Where a newly added widget should be docked, relative to the whole board. */
export type DockDirection = 'above' | 'below' | 'left' | 'right' | 'within';

interface Zone {
    direction: DockDirection;
    label: string;
    icon: React.ReactElement;
    area: string;
}

const ZONES: Zone[] = [
    { direction: 'above', label: 'Top', icon: <MdArrowUpward size={20} />, area: 'top' },
    { direction: 'left', label: 'Left', icon: <MdArrowBack size={20} />, area: 'left' },
    { direction: 'within', label: 'New tab', icon: <MdTab size={18} />, area: 'center' },
    { direction: 'right', label: 'Right', icon: <MdArrowForward size={20} />, area: 'right' },
    { direction: 'below', label: 'Bottom', icon: <MdArrowDownward size={20} />, area: 'bottom' },
];

interface DockPlacementModalProps {
    isOpen: boolean;
    widgetName: string;
    onSelect: (direction: DockDirection) => void;
    onCancel: () => void;
}

/**
 * Shown whenever a widget is added to a non-empty board, in place of it just
 * appearing as another tab. Picking a side splits the whole board in that
 * direction (dockview's `position: { direction }`); "New tab" keeps the old
 * behaviour of docking into the currently active group.
 */
const DockPlacementModal: React.FC<DockPlacementModalProps> = ({ isOpen, widgetName, onSelect, onCancel }) => {
    const [colors] = useAppColors();

    return (
        <Modal isOpen={isOpen} onClose={onCancel} isCentered size="sm">
            <ModalOverlay />
            <ModalContent
                bgColor={colors.surfaceAlt}
                textColor={colors.fore}
                borderRadius={RADIUS.lg}
                borderColor={colors.border}
                borderWidth={1}
                onMouseDown={stopPropagation}
                onTouchStart={stopPropagation}
            >
                <ModalHeader borderBottomColor={colors.border} borderBottomWidth={1} fontSize={16}>
                    Place "{widgetName}"
                </ModalHeader>
                <ModalCloseButton
                    borderWidth={1}
                    borderRadius={RADIUS.md}
                    borderColor={colors.border}
                    _hover={{ bgColor: colors.surfaceSubtle, color: colors.fore }}
                />
                <ModalBody paddingY={6} paddingBottom={8}>
                    <Text fontSize="sm" color={colors.foreHalf} marginBottom={4} textAlign="center">
                        Choose where to dock the new widget.
                    </Text>
                    <Box
                        display="grid"
                        gridTemplateAreas={`". top ." "left center right" ". bottom ."`}
                        gridTemplateColumns="64px 92px 64px"
                        gridTemplateRows="56px 56px 56px"
                        gap={2}
                        width="fit-content"
                        margin="0 auto"
                    >
                        {ZONES.map((z) => (
                            <Box
                                key={z.direction}
                                as="button"
                                type="button"
                                style={{ gridArea: z.area }}
                                onClick={() => onSelect(z.direction)}
                                display="flex"
                                flexDirection="column"
                                alignItems="center"
                                justifyContent="center"
                                gap={1}
                                bg={colors.infoBarely}
                                borderWidth={1}
                                borderColor={colors.infoHalf}
                                borderRadius={RADIUS.md}
                                color={colors.info}
                                _hover={{ bg: colors.infoQuarter, borderColor: colors.info }}
                                transition="background-color 120ms ease, border-color 120ms ease"
                            >
                                {z.icon}
                                <Text fontSize="xs">{z.label}</Text>
                            </Box>
                        ))}
                    </Box>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
};

export default DockPlacementModal;
