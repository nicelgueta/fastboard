import React from 'react';
import { ChakraProvider, VStack } from '@chakra-ui/react';

import DashboardContainer from './layout/Main';

const App: React.FC = () => {
    const appName: string = "FastBoard";
    return (
        <ChakraProvider>
            <VStack h={"100%"} w={"100%"}>
                <DashboardContainer 
                    appName={appName}
                />
            </VStack>
        </ChakraProvider>
    );
}

export default App;
