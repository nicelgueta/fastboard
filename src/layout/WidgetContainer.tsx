import React, { useState } from 'react';
import { VStack, Box, ButtonGroup, Text, IconButton,useMediaQuery, Grid, GridItem } from '@chakra-ui/react';
import { MdSettings } from 'react-icons/md';
import { AiFillPushpin } from 'react-icons/ai';
import { VscClose, VscSaveAs } from 'react-icons/vsc';
import useAppColors from '../hooks/useAppColors';
import { stopPropagation } from '../components/common';
import { WidgetSetting } from '../interfaces';
import SettingsModal from '../modals/SettingsModal';
import SaveAsModal from '../modals/SaveAsModal';
import FBInput from '../components/primitive/Input';
import { useWidgetState, AllWidgetStates } from '../reducers/recoilStates';
import { useRecoilState } from 'recoil';

interface WidgetContainerProps {
    name: string;
    wKey: string;
    widgetType: string;
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
    widgetType,
    isStatic,
    settingsConfig,
    WidgetElement,
    removeWidget,
    toggleStatic,
    saveWidgetSettings,
    currentSettings,
}: WidgetContainerProps) => {
    const [colors] = useAppColors();
    const [widgetSettings, setWidgetSettings] = useState<SetSettings>(
        currentSettings || getDefaultSettings(settingsConfig)
    );
    const [settingsIsOpen, setSettingsOpen] = useState(false);
    const [saveAsIsOpen, setSaveAsOpen] = useState(false);
    const [isLargerThan1280] = useMediaQuery('(min-width: 1280px)');
    const [ editingName, setEditingName ] = useState<boolean>(false);
    const [ allWidgetStates, setAllWidgetStates ] = useRecoilState(AllWidgetStates);
    const [ widgetState, setWidgetState ] = useWidgetState([allWidgetStates, setAllWidgetStates], wKey);
    const [ widgetName , setWidgetName ] = useState(widgetState?.name || name);

    const saveWidgetName = (newName: string) => {
        setWidgetState({...widgetState, name: newName});
    }

    const containerRef = React.useRef<HTMLDivElement>(null);

    const saveSettings = (sts: SetSettings) => {
        saveWidgetSettings(wKey, sts);
        setWidgetSettings(sts);
    }
    // delete widget state on unmount
    React.useEffect(() => {
        return () => {
            const newWidgets = {...allWidgetStates};
            delete newWidgets[wKey];
            setAllWidgetStates(newWidgets);
        }
    }, []);

    return (
        <Box
            w={"100%"}
            h={"100%"}
            bgColor={colors.bg}
            textColor={colors.fore}
            borderWidth={1}
            borderColor={colors.infoDark}
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
            <SaveAsModal
                storeName={"saved_widgets"}
                objToSave={{type: widgetType, settings: widgetSettings}}
                isOpen={saveAsIsOpen}
                setIsOpen={setSaveAsOpen}
                helperText='Provide a name to save this widget settings'
            />
            <VStack h="100%" w="100%" spacing={0}>
                <Grid
                    templateColumns="repeat(6, 1fr)"
                    w="100%"
                >
                    <GridItem colSpan={3} h="20px">
                        {
                            editingName ?
                            <FBInput
                                id={`${wKey}-name-input`}
                                typ="info"
                                size="xs"
                                w="100%"
                                maxW={300}
                                value={widgetName}
                                setValue={setWidgetName}
                                onBlur={() => {setEditingName(false); saveWidgetName(widgetName)}}
                            />
                                :
                            <Text
                                onMouseDown={() => {setEditingName(true); document.getElementById(`${wKey}-name-input`)?.focus()}}
                                color={colors.fore}
                                fontFamily="courier new"
                                w="100%"
                                maxW={300}
                                fontSize={14}
                                borderTopLeftRadius={5}
                                paddingLeft={2}
                            >
                                {widgetName}
                            </Text>
                        }
                    </GridItem>
                    <GridItem colSpan={2} colStart={5} justifySelf={"flex-end"}>
                        <ButtonGroup
                            size='xs'
                            isAttached
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
                                aria-label='settings-widge'
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
                                key={`topbar-saveAs`}
                                onClick={() => {setSaveAsOpen(true)}}
                                aria-label='save-widge'
                                alignSelf={"flex-end"}
                                bg={colors.bg}
                                borderWidth={1}
                                _hover={{ bg: colors.fore, color: colors.bg, borderColor: colors.bg }}
                                _active={{ bg: colors.info, color: colors.bg, borderColor: colors.bg }}
                                icon={<VscSaveAs />}
                                isActive={saveAsIsOpen}
                                disabled={!isLargerThan1280} //cannot move if on phone
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
                    </GridItem>
                </Grid>
                <div ref={containerRef} style={{ 
                    height: "100%", 
                    width: "100%", 
                    overflow: "auto" 
                }} id={`${wKey}-div-container`}>
                    <WidgetElement 
                        wKey={wKey}
                        isStatic={isStatic}
                        containerRef={containerRef} 
                        settingsIsOpen={settingsIsOpen}
                        {...widgetSettings} 
                    />
                </div>
            </VStack>
        </Box>
    );
};

export default WidgetContainer;
