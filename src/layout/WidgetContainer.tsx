import React, { useState } from 'react';
import { VStack, HStack, Box, ButtonGroup, Text, IconButton, Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter, Button, Select, Switch, useMediaQuery } from '@chakra-ui/react';
import { MdSettings } from 'react-icons/md';
import { AiFillPushpin } from 'react-icons/ai';
import { VscClose } from 'react-icons/vsc';
import useAppColors from '../hooks/colors';
import { stopPropagation } from '../hooks/stoppropagation';

import { WidgetSetting } from '../interfaces';
import SettingsModal from '../modals/SettingsModal';

interface WidgetContainerProps {
    name: string;
    wKey: string;
    isStatic: boolean;
    settingsConfig: WidgetSetting[];
    WidgetElement: React.ElementType;
    removeWidget: (key: string) => void;
    toggleStatic: (key: string) => void;
    saveWidgetSettings: (key: string, settings: Record<string, any>) => void;
    currentSettings?: Record<string, any>;
}

interface SetSettings {
    [key: string]: string | number | boolean | undefined
}

const getDefaultSettings = (settings: WidgetSetting[]): SetSettings => {
    const defaultSettings: SetSettings = {};
    settings.forEach((setting) => {
        defaultSettings[setting.settingsKey] = setting.default;
    });
    return defaultSettings;
}

const WidgetContainer: React.FC<WidgetContainerProps> = ({
    name,
    wKey,
    isStatic,
    settingsConfig,
    WidgetElement,
    removeWidget,
    toggleStatic,
    saveWidgetSettings,
    currentSettings
}: WidgetContainerProps) => {
    const colors = useAppColors();
    const [widgetSettings, setWidgetSettings] = useState<SetSettings>(
        currentSettings || getDefaultSettings(settingsConfig)
    );
    const [settingsIsOpen, setSettingsOpen] = useState(false);
    const [isLargerThan1280] = useMediaQuery('(min-width: 1280px)');

    const saveSettings = (sts: SetSettings) => {
        saveWidgetSettings(wKey, sts);
        setWidgetSettings(sts);
    }
    console.log(currentSettings)
    console.log(widgetSettings)
    return (
        <Box
            w={"100%"}
            h={"100%"}
            bgColor={colors.bg}
            textColor={colors.fore}
            borderWidth={1}
            borderColor={colors.infoQuarter}
            borderRadius={0}
        >
            <SettingsModal 
                name={name}
                settingsIsOpen={settingsIsOpen}
                setSettingsOpen={setSettingsOpen}
                settingsConfig={settingsConfig}
                currentSettings={widgetSettings}
                settingsCallback={saveSettings}
            />
            <VStack h="100%" w="100%">
                <HStack
                    w="100%"
                    h="20px"
                    borderTopRightRadius={0}
                    borderTopLeftRadius={0}
                >
                    <Text
                        color={colors.fore}
                        fontFamily="courier new"
                        w="100%"
                        fontSize={14}
                        borderTopLeftRadius={5}
                        paddingLeft={2}
                    >
                        {name}
                    </Text>
                    <ButtonGroup
                        size='xs'
                        isAttached
                        alignSelf={"flex-end"}
                        variant='outline'
                        borderColor={colors.fore}
                        onMouseDown={stopPropagation}
                        onTouchStart={stopPropagation}
                    >
                        <IconButton
                            h="20px"
                            color={colors.fore}
                            key={`topbar-cog`}
                            onClick={() => setSettingsOpen(true)}
                            aria-label='rem-widge'
                            alignSelf={"flex-end"}
                            bg={colors.bg}
                            borderWidth={1}
                            _hover={{ bg: colors.fore, color: colors.bg, borderColor: colors.bg }}
                            _active={{ bg: colors.info, color: colors.bg, borderColor: colors.bg }}
                            icon={<MdSettings />}
                            isActive={settingsIsOpen}
                            borderColor={colors.bgDark}
                            borderRadius={0}
                            borderTopRightRadius={0}
                        />
                        <IconButton
                            h="20px"
                            color={colors.fore}
                            key={`topbar-pin`}
                            onClick={() => toggleStatic(wKey)}
                            aria-label='rem-widge'
                            alignSelf={"flex-end"}
                            bg={colors.bg}
                            borderWidth={1}
                            _hover={{ bg: colors.fore, color: colors.bg, borderColor: colors.bg }}
                            _active={{ bg: colors.info, color: colors.bg, borderColor: colors.bg }}
                            icon={<AiFillPushpin />}
                            isActive={isLargerThan1280 ? isStatic : true}
                            disabled={!isLargerThan1280} //cannot move if on phone
                            borderColor={colors.bgDark}
                            borderRadius={0}
                            borderTopRightRadius={0}
                        />
                        <IconButton
                            h="20px"
                            color={colors.fore}
                            key={`topbar-x`}
                            onClick={() => removeWidget(wKey)}
                            aria-label='rem-widge'
                            alignSelf={"flex-end"}
                            bg={colors.bg}
                            borderWidth={1}
                            _hover={{ bg: "red.400", color: colors.bg }}
                            icon={<VscClose />}
                            borderColor={colors.bgDark}
                            borderRadius={0}
                            borderTopRightRadius={0}
                        />
                    </ButtonGroup>
                </HStack>
                <div style={{ height: "100%", width: "100%", overflow: "auto" }} id={`${wKey}-div-container`}>
                    <WidgetElement {...widgetSettings} />
                </div>
            </VStack>
        </Box>
    );
};

export default WidgetContainer;
