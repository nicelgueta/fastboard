import React from 'react';
import { ChakraProvider, ColorModeScript, VStack } from '@chakra-ui/react';
import { RecoilRoot } from 'recoil';
import DashboardContainer from './layout/Main';
import { WidgetConfig, WidgetComponentMapping } from './interfaces';
import theme, { forcedDarkColorModeManager } from './theme';

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
        <RecoilRoot>
            <ColorModeScript initialColorMode="dark" type="localStorage" />
            <ChakraProvider theme={theme} colorModeManager={forcedDarkColorModeManager}>
                <title>{appName}</title>
                <VStack h={"100%"} w={"100%"}>
                    <DashboardContainer 
                        appName={appName}
                        widgetConfig={widgetConfig}
                        widgetComponentMapping={widgetComponentMapping}
                    />
                </VStack>
            </ChakraProvider>
        </RecoilRoot>
    );
}

export default FastBoard;
