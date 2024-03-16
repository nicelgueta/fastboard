import React from 'react';
import { Box, Heading, Text } from '@chakra-ui/react';
import { WidgetSetting } from '../interfaces';

interface SettingsProps {
    widgetSettings: WidgetSetting[];
    setWidgetSettings: (settings: WidgetSetting[]) => void;
}


const Settings: React.FC<SettingsProps> = ({
    widgetSettings,
    setWidgetSettings
}: SettingsProps) => {

    return (
        <Box p={4}>
        <Heading as="h1" size="lg" mb={4}>
            Settings
        </Heading>
        <Text>
            This is the settings page. You can update your settings here.
        </Text>
        </Box>
    );
}

export default Settings;