import React from 'react';
import { VStack } from '@chakra-ui/react';
import DashboardContainer from './layout/Main';
import { WidgetConfig, WidgetComponentMapping } from './interfaces';

export interface FastBoardProps {
    widgetConfig: WidgetConfig;
    widgetComponentMapping: WidgetComponentMapping;
    appName?: string;
}

// The dashboard itself. Theme/colour-mode providers are supplied by the app
// shell (Providers.tsx) so this and the landing page share them.
const FastBoard: React.FC<FastBoardProps> = ({
    appName, widgetConfig, widgetComponentMapping
}) => {
    appName = appName || "FastBoard";
    return (
        <>
            <title>{appName}</title>
            <VStack h={"100%"} w={"100%"}>
                <DashboardContainer
                    appName={appName}
                    widgetConfig={widgetConfig}
                    widgetComponentMapping={widgetComponentMapping}
                />
            </VStack>
        </>
    );
}

export default FastBoard;
