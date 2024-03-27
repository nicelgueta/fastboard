import React from 'react';
import { HStack, Text, VStack, Grid, GridItem, Center } from '@chakra-ui/react';
import { WidgetSetting } from '../interfaces';

import FBInput from './primitive/Input';
import FBNumberInput from './primitive/NumberInput';
import FBSelect from './primitive/Select';
import FBSwitch from './primitive/Switch';
import FBMultiSelect from './primitive/MultiSelect';
import FBSlider from './primitive/Slider';
import FBTextarea from './primitive/Textarea';
import { componentType, settingType } from '../interfaces';
import useAppColors from '../hooks/useAppColors';

export const SettingsMap: Record<settingType, React.FC<any>> = {
    input: FBInput,
    number: FBNumberInput,
    select: FBSelect,
    switch: FBSwitch,
    multiSelect: FBMultiSelect,
    slider: FBSlider,
    textarea: FBTextarea,
    date: (props) => <FBInput {...props} type="date" />
}

interface SettingComponentProps {
    setting: WidgetSetting;
    stateCallback: (key: string, value: any) => void;
    value: string | number | boolean | Date | undefined;
    inputTyp?: componentType;
}

const SettingComponent: React.FC<SettingComponentProps> = (
    {setting, stateCallback, value, inputTyp}
    ) => {
        const [colors] = useAppColors();
        const InputComponent = SettingsMap[setting.type];
        return (
            <>
        <GridItem textAlign={"right"} paddingRight={5}>
            <Center h="100%">
                <Text w="100%">
                    {setting.label}
                </Text>
                {setting.required ? <Text color={colors.fail} paddingLeft={2}>*</Text> : null}
            </Center>
        </GridItem>
        <GridItem>
            <InputComponent
                typ={setting.inputTyp || inputTyp || "info"} 
                value={value} 
                setValue={(v)=>stateCallback(setting.settingsKey, v)}
                options={setting.options}
                min={setting.min}
                max={setting.max}
                step={setting.step}
            />
        </GridItem>
        </>
    )
}

interface SettingsProps {
    settingsConfig: WidgetSetting[];
    currentSettings: Record<string, string | number | boolean | Date | undefined>;
    updateSetting: (key: string, value: any) => void;
    inputTyp?: componentType
}
const Settings: React.FC<SettingsProps> = ({
    settingsConfig,
    currentSettings,
    updateSetting,
    inputTyp
}: SettingsProps) => {

    return (
        <Grid templateColumns='repeat(2, 1fr)' gap={3}>
        {
            settingsConfig.map((setting, i) => (
                <SettingComponent 
                    key={`SettingComponent-${i}`}
                    setting={setting}
                    value={currentSettings[setting.settingsKey]}
                    stateCallback={updateSetting}
                    inputTyp={inputTyp}
                />
            ))
        }
        </Grid>
    );
}

export default Settings;