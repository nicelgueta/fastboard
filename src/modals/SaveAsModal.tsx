import React from 'react';
import { 
    Box,
    Modal, 
    ModalBody, 
    ModalCloseButton, 
    ModalContent, 
    ModalFooter, 
    ModalHeader, 
    ModalOverlay, 
    VStack,
    Text,
    Center,
    Tooltip
} from '@chakra-ui/react';
import useAppColors, { RADIUS } from '../hooks/useAppColors';
import { getStorage, Collection } from '../store/storage';
import { stopPropagation } from '../components/common';

import FBButton from '../components/primitive/Button';
import FBInput from '../components/primitive/Input';

interface SaveAsModalProps {
    storeName: Collection;
    objToSave: any;
    isOpen: boolean;
    setIsOpen: (value: boolean) => void;
    callback?: (key: string) => void;
    helperText?: string;
}

const SaveAsModal: React.FC<SaveAsModalProps> = ({
    storeName,
    objToSave,

    isOpen,
    setIsOpen,
    callback,
    helperText
}) => {
    const [colors] = useAppColors();

    const [saveKey, setSaveKey] = React.useState<string>("");
    const [currentNames, setCurrentNames] = React.useState<string[]>([]);

    React.useEffect(() => {
        if (!isOpen) return;
        getStorage().list(storeName).then(setCurrentNames).catch(() => setCurrentNames([]));
    }, [isOpen, storeName]);

    const saveObject = async () => {
        if (saveKey) {
            await getStorage().set(storeName, saveKey, objToSave);
            setIsOpen(false);
            callback && callback(saveKey);
        }
    }
    return (
        <Modal 
            isOpen={isOpen} 
            onClose={() => setIsOpen(false)}
            size={'2xl'}
        >
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
                <ModalHeader
                    borderBottomColor={colors.border}
                    borderBottomWidth={1}
                    fontSize={18}
                >
                    Save As
                </ModalHeader>
                <ModalCloseButton
                    borderWidth={1}
                    borderRadius={RADIUS.lg}
                    borderColor={colors.border}
                    _hover={{ bgColor: colors.surfaceSubtle, color: colors.fore }}
                />
                <ModalBody paddingTop={5}>
                    <Center>
                        <VStack w="75%" textAlign={"left"}>
                            <Text w="100%">{helperText||""}</Text>
                            <FBInput
                                typ="info"
                                value={saveKey}
                                setValue={setSaveKey}
                            />
                        </VStack>
                    </Center>
                </ModalBody>

                <ModalFooter>
                    <Tooltip
                        bg={colors.warning}
                        borderRadius={RADIUS.lg}
                        textColor={colors.fore}
                        placement="top"
                        hasArrow
                        label="Save will overwrite existing widget with this name"
                        isDisabled={!currentNames.includes(saveKey)}
                    >
                        <span>
                            <FBButton
                                typ={currentNames.includes(saveKey) ? "warning" : "info"}
                                isOutline
                                onClick={() => void saveObject()}
                                isDisabled={saveKey === ""}
                                >
                                Save
                            </FBButton>
                        
                        </span>
                    </Tooltip>
            </ModalFooter>
            </ModalContent>
        </Modal>
    )
}

export default SaveAsModal;