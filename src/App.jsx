import React from 'react';
import { 
    ChakraProvider
} from '@chakra-ui/react';

import NavHeader from './nav/nav-header';
import NavMenu from './nav/nav';

const App = () => {
    const [menuOpen, setMenuOpen] = React.useState(false);
    const toggleMenuOpen = () => setMenuOpen(!menuOpen);
    return (
        <ChakraProvider>
            <NavHeader toggleNav={toggleMenuOpen} menuOpen={menuOpen}/>
            <NavMenu navOpen={menuOpen} navClose={toggleMenuOpen} />
        </ChakraProvider>
    )
}

export default App;