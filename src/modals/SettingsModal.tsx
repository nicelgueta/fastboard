import React from 'react';
import { 
    Modal, 
    ModalBody, 
    ModalCloseButton, 
    ModalContent, 
    ModalFooter, 
    ModalHeader, 
    ModalOverlay 
} from '@chakra-ui/react';
import useAppColors from '../hooks/colors';
import { stopPropagation } from '../hooks/stoppropagation';

import Settings from '../components/Settings';
import { WidgetSetting } from '../interfaces';
import FBButton from '../components/primitive/Button';

interface SettingsModalProps {
    name: string;
    settingsIsOpen: boolean;
    setSettingsOpen: (value: boolean) => void;
    settingsConfig: WidgetSetting[];
    currentSettings: Record<string, any>;
    settingsCallback: (settings: Record<string, any>) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
    name,
    settingsIsOpen,
    setSettingsOpen,
    settingsConfig,
    currentSettings,
    settingsCallback
}) => {
    const colors = useAppColors();

    const [widgetSettings, setWidgetSettings] = React.useState<Record<string, any>>(currentSettings);

    const updateSetting = (key: string, value: any) => {
        setWidgetSettings({
            ...widgetSettings,
            [key]: value
        });
    }

    return (
        <Modal 
                isOpen={settingsIsOpen} 
                onClose={() => setSettingsOpen(false)}
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
                        {`${name} Settings`}
                    </ModalHeader>
                    <ModalCloseButton
                        borderWidth={1}
                        borderRadius={0}
                        borderColor={colors.fore}
                        _hover={{ bgColor: colors.fore, color: colors.bg }}
                    />
                    <ModalBody paddingTop={5}>
                        <Settings 
                            settingsConfig={settingsConfig}
                            currentSettings={widgetSettings}
                            updateSetting={updateSetting}
                            
                        />
                    </ModalBody>

                    <ModalFooter>
                        <FBButton
                            typ="success"
                            isOutline
                            onClick={() => {
                                settingsCallback(widgetSettings);
                                setSettingsOpen(false)
                            }}
                        >
                            Save
                        </FBButton>
                    </ModalFooter>
                </ModalContent>
            </Modal>
    )
}

export default SettingsModal;