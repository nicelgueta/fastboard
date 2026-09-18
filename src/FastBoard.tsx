import React from 'react';
import { ChakraProvider, ColorModeScript, VStack } from '@chakra-ui/react';
import DashboardContainer from './layout/Main';
import { WidgetConfig, WidgetComponentMapping } from './interfaces';
import theme, { colorModeManager } from './theme';
import { AppearanceProvider } from './hooks/useAppColors';

export interface FastBoardProps {
    widgetConfig: WidgetConfig;
    widgetComponentMapping: WidgetComponentMapping;
    appName?: string;
}

const FastBoard: React.FC<FastBoardProps> = ({
    appName, widgetConfig, widgetComponentMapping
}) => {
    appName = appName || "FastBoard";
    return (
        <>
            <ColorModeScript
                initialColorMode="dark"
                type="localStorage"
                storageKey="fastboard-color-mode"
            />
            <ChakraProvider theme={theme} colorModeManager={colorModeManager}>
                <AppearanceProvider>
                    <title>{appName}</title>
                    <VStack h={"100%"} w={"100%"}>
                        <DashboardContainer
                            appName={appName}
                            widgetConfig={widgetConfig}
                            widgetComponentMapping={widgetComponentMapping}
                        />
                    </VStack>
                </AppearanceProvider>
            </ChakraProvider>
        </>
    );
}

export default FastBoard;
