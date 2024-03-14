import React from "react";
import { 
    AccordionButton,
    AccordionItem,
    AccordionIcon,
    AccordionPanel,
    Box,
    List,
    ListIcon,
    ListItem,
    Link
} from "@chakra-ui/react";

import { AiOutlineArrowRight } from "react-icons/ai";
import { useColorMode } from '@chakra-ui/color-mode';
import useAppColors from "../hooks/colors";

var urlReg = /^https{0,1}\:\/\/.*/;
var isUrl = (str) => urlReg.test(str);

const NavMenuSection = (props) => {
    const { colorMode, } = useColorMode();
    const colors = useAppColors();
    const txtColor = colors.fore;
    return (
        <AccordionItem>
            <h2>
            <AccordionButton>
                <Box flex='1' textAlign='left'>
                {props.header}
                </Box>
                <AccordionIcon />
            </AccordionButton>
            </h2>
            <AccordionPanel pb={4}>
            <List spacing={3}>
            {
                props.subsections.map(subsection=>{
                    return (
                        <ListItem textColor={subsection.linkDisabled ? "gray.500" : txtColor}>
                            <ListIcon as={subsection.icon} color={subsection.linkDisabled ? "gray.500" : txtColor} />
                            {
                                subsection.linkDisabled ?
                                subsection.name 
                                :
                                isUrl(subsection.link) ? 
                                <a href={subsection.link}>
                                    {subsection.name}
                                </a>
                                :
                                <Link 
                                    onClick={()=>props.navClose()} 
                                    to={subsection.link} 
                                >
                                    {subsection.name}
                                </Link>
                            }
                        </ListItem>
                    )
                })
            }
            </List>
            </AccordionPanel>
        </AccordionItem>
    )
}

export default NavMenuSection;