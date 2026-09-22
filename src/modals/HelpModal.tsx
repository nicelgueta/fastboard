import React from 'react';
import {
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalHeader,
    ModalOverlay,
    Text,
} from '@chakra-ui/react';
import useAppColors, { RADIUS } from '../hooks/useAppColors';
import { stopPropagation } from '../components/common';

interface HelpModalProps {
    /** The tool's name, e.g. "Counter" - not the tab's (possibly renamed) title. */
    toolName: string;
    /** The tool's description from its config - the same short blurb the Add tool menu shows. */
    description: string;
    isOpen: boolean;
    setIsOpen: (value: boolean) => void;
}

/**
 * Generic per-widget help: reuses each widget's own config.description (the
 * same text the Add tool menu already shows), so every widget gets a Help
 * entry in its tab's right-click menu for free - see Main.tsx's
 * getTabContextMenuItems and WidgetPanel.tsx.
 */
const HelpModal: React.FC<HelpModalProps> = ({ toolName, description, isOpen, setIsOpen }) => {
    const [colors] = useAppColors();

    return (
        <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} size="lg">
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
                <ModalHeader borderBottomColor={colors.border} borderBottomWidth={1} fontSize={18}>
                    {toolName}
                </ModalHeader>
                <ModalCloseButton
                    borderWidth={1}
                    borderRadius={RADIUS.lg}
                    borderColor={colors.border}
                    _hover={{ bgColor: colors.surfaceSubtle, color: colors.fore }}
                />
                <ModalBody paddingTop={5} paddingBottom={5}>
                    <Text color={colors.fore}>{description || 'No description available for this tool.'}</Text>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
};

export default HelpModal;
