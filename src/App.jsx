import React from 'react';
import { 
    ChakraProvider
} from '@chakra-ui/react';

import NavHeader from './nav/nav-header';
import NavMenu from './nav/nav';

import Main from './layout/Main';

const App = () => {
    const appName = "FastBoard";
    const [menuOpen, setMenuOpen] = React.useState(false);
    const toggleMenuOpen = () => setMenuOpen(!menuOpen);
    return (
        <ChakraProvider>
            <NavHeader toggleNav={toggleMenuOpen} menuOpen={menuOpen}/>
            <NavMenu navOpen={menuOpen} navClose={toggleMenuOpen} appName={appName} />
            <Main 
                appName={appName}
            />
        </ChakraProvider>
    )
}

export default App;