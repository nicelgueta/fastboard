import { Grid, GridItem, Heading, HStack } from "@chakra-ui/layout";
import { ColorModeSwitcher } from '../components/ColorModeSwitcher';
import { MdAccountCircle, MdMenu } from 'react-icons/md';
import { AiOutlineGithub } from  'react-icons/ai';
import React from "react";
import { useColorMode } from '@chakra-ui/color-mode';
import useAppColors from "../hooks/colors";
import { 
    Center,
    Link,
    IconButton,
    Button
} from '@chakra-ui/react';

// app components
import TextSearch from "../components/TextSearch";
import Bu from "../components/Button";

const NavHeader = ({
    toggleNav,
    menuOpen,
    addWidget,
    allWidgets,
    layouts,
    appName
}) => {

    const { colorMode, } = useColorMode();
    const colors = useAppColors();
    const txtColor = colors.fore
    const allWidgetItems = allWidgets.map((widget, i)=>{
        return {
            label: widget.name,
            value: widget.type
        }
    })

    const layoutItems = layouts?.map((layout, i)=>{
        return {
            label: layout.name,
            value: layout.type
        }
    })

    return (
        <Grid            
            textAlign="left" 
            templateColumns='repeat(20, 1fr)'
            bg={colors.bgHalf}
        >
            <GridItem colSpan={1} padding={1}>
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
                        {appName}            
                    </Heading>

                    </Link>
                </HStack>
            </GridItem>
            <GridItem colSpan={3} padding={1}>
                <Center w="100%" h="100%">
                    <HStack
                        w="100%"
                        h="100%"
                        spacing={1}
                    >
                        <TextSearch
                            w="100%"
                            h="85%"
                            placeholder="Layout"
                            items={layoutItems}
                            callback={()=>alert('load layout')}
                            buttonText="LOAD"
                            buttonType="warning"
                        />
                        <Bu
                            type="action"
                            h="85%"
                            onClick={()=>alert('save layout')}

                        >
                            SAVE
                        </Bu>
                    </HStack>
                </Center>
            </GridItem>
            <GridItem colSpan={3} padding={1}>
                <Center w="100%" h="100%">
                    <TextSearch
                        w="100%"
                        h="85%"
                        placeholder="Tool"
                        items={allWidgetItems}
                        callback={addWidget}
                        buttonText="ADD"
                        buttonType="success"
                    />
                </Center>
            </GridItem>
            <GridItem justifySelf="flex-end" colSpan={13}>
                <HStack>
                    <IconButton variant="ghost" size="sm" color={txtColor}
                        onClick={()=>toggleNav(!menuOpen)}
                        
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