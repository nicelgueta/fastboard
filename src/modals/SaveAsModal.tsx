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
import useAppColors from '../hooks/useAppColors';
import useKvStore from '../hooks/useKvStore';
import { stopPropagation } from '../components/common';

import FBButton from '../components/primitive/Button';
import FBInput from '../components/primitive/Input';

interface SaveAsModalProps {
    storeName: string;
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

    const { set: setObject, list: listObjectKeys } = useKvStore(storeName);

    React.useEffect(() => {
        const names = listObjectKeys();
        setCurrentNames( names || []);
    }, []);

    const saveObject = () => {
        if (saveKey) {
            setObject(saveKey, objToSave);
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
                bgColor={colors.bg}
                textColor={colors.fore}
                fontFamily="courier new"
                borderRadius={0}
                borderColor={colors.fore}
                borderWidth={1}
                onMouseDown={stopPropagation}
                onTouchStart={stopPropagation}
            >
                <ModalHeader
                    borderBottomColor={colors.fore}
                    borderBottomWidth={1}
                    fontSize={18}
                >
                    Save As
                </ModalHeader>
                <ModalCloseButton
                    borderWidth={1}
                    borderRadius={0}
                    borderColor={colors.fore}
                    _hover={{ bgColor: colors.fore, color: colors.bg }}
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
                        borderRadius={0}
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
                                onClick={saveObject}
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