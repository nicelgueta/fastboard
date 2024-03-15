import { Grid, GridItem, Heading, HStack } from "@chakra-ui/layout";
import { ColorModeSwitcher } from '../components/ColorModeSwitcher';
import { MdAccountCircle, MdMenu } from 'react-icons/md';
import { AiOutlineGithub } from  'react-icons/ai';
import React from "react";
import { useColorMode } from '@chakra-ui/color-mode';
import useAppColors from "../hooks/colors";
import { 
    Button, 
    Image, 
    IconButton, 
    Slide,
    Stack,
    Text,
    Link
} from '@chakra-ui/react';

const NavHeader = (props) => {
    const { colorMode, } = useColorMode();
    const colors = useAppColors();
    const txtColor = colors.fore
    return (
        <Grid 
            w="100%"
            textAlign="left" 
            templateColumns='repeat(20, 1fr)'
            bg={colors.bgHalf}
        >
            <GridItem colSpan={1} padding={1} w={[300, 400, 500]}>
                <HStack h="100%">
                    <Link to="/home">
                    <Heading
                        alignSelf={"center"}
                        h="100%"
                        alignContent={"center"}
                        fontSize={18}
                        bgClip='text'
                        bgGradient={`linear(to-r, ${colors.fore}, ${colors.fore})`}                    
                    >
                        Home            
                    </Heading>

                    </Link>
                </HStack>
            </GridItem>
            <GridItem colSpan={13}>
            </GridItem>
            <GridItem justifySelf="flex-end" colSpan={6}>
                <HStack>
                    <IconButton variant="ghost" size="sm" color={txtColor}
                        onClick={()=>props.toggleNav(!props.menuOpen)}
                        
                    ><MdMenu size={30} /></IconButton>
                    {/* <IconButton 
                        variant="ghost" 
                        size="sm" 
                        color={txtColor}
                        isDisabled
                        // onClick={()=>alert('account')} 
                    ><MdAccountCircle size={30}   /></IconButton> */}
                    <IconButton 
                        variant="ghost" 
                        size="sm" 
                        color={txtColor}
                        onClick={()=>window.open("https://github.com/nicelgueta", "_blank").focus()}
                        ><AiOutlineGithub size={30}   /></IconButton>
                    <ColorModeSwitcher color={txtColor} justifySelf="flex-end" />
                </HStack>
            </GridItem>
        </Grid>
    )
};

export default NavHeader;