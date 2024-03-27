import React from 'react';
import { 
    Modal, 
    ModalBody, 
    ModalCloseButton, 
    ModalContent, 
    ModalFooter, 
    ModalHeader, 
    ModalOverlay, 
    Tooltip
} from '@chakra-ui/react';
import useAppColors from '../hooks/useAppColors';
import { stopPropagation } from '../components/common';

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
    saveBtnText?: string;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
    name,
    settingsIsOpen,
    setSettingsOpen,
    settingsConfig,
    currentSettings,
    settingsCallback,
    saveBtnText
}) => {
    const [colors] = useAppColors();
    const [widgetSettings, setWidgetSettings] = React.useState<Record<string, any>>(currentSettings);
    const [ saving, setSaving ] = React.useState<boolean>(false);

    const executeCallback = () => {
        setSaving(true);
        settingsCallback(widgetSettings);
        setSaving(false);
        setSettingsOpen(false);
    }
    React.useEffect(() => {
        const defaults = settingsConfig.reduce((acc, setting) => {
                acc[setting.settingsKey] = setting.default;
                return acc;
            }, {} as Record<string, any>
        );
        setWidgetSettings({
            ...defaults,
            ...currentSettings
        });
        return () => {
            setWidgetSettings({});
        }

    }, [settingsIsOpen]);

    const updateSetting = (key: string, value: any) => {
        setWidgetSettings({
            ...widgetSettings,
            [key]: value
        });
    }
    const canProceed = settingsConfig.every(setting => {
        const value = widgetSettings[setting.settingsKey];
        if (setting.required && (value === undefined || value === null)) {
            return false;
        }
        return true;
    })
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
                        {name}
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
                        <Tooltip
                            bg={colors.fail}
                            borderRadius={0}
                            textColor={colors.fore}
                            placement="top"
                            hasArrow
                            label="Complete all required fields"
                            isDisabled={canProceed}
                        >
                            <span>
                                <FBButton
                                    typ={canProceed ? "success" : "fail"}
                                    variant={canProceed ? undefined : "outline"}
                                    isDisabled={!canProceed}
                                    onClick={executeCallback}
                                >
                                    {   saving ? "Saving..." :
                                        saveBtnText?saveBtnText:"Save"}
                                </FBButton>
                            
                            </span>
                        </Tooltip>
                    </ModalFooter>
                </ModalContent>
            </Modal>
    )
}

export default SettingsModal;