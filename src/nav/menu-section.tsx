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
    Link as ChakraLink
} from "@chakra-ui/react";

import { AiOutlineArrowRight } from "react-icons/ai";
import { useColorMode } from '@chakra-ui/color-mode';
import useAppColors from "../hooks/colors";

const urlReg = /^https{0,1}\:\/\/.*/;
const isUrl = (str: string): boolean => urlReg.test(str);

interface Subsection {
    icon: React.ElementType;
    name: string;
    link: string;
    linkDisabled?: boolean;
}

interface NavMenuSectionProps {
    header: string;
    subsections: Subsection[];
    navClose: () => void;
}

const NavMenuSection: React.FC<NavMenuSectionProps> = (props) => {
    const { colorMode } = useColorMode();
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
                    {props.subsections.map(subsection => (
                        <ListItem key={subsection.name} textColor={subsection.linkDisabled ? "gray.500" : txtColor}>
                            <ListIcon as={subsection.icon} color={subsection.linkDisabled ? "gray.500" : txtColor} />
                            {subsection.linkDisabled ?
                                subsection.name :
                                isUrl(subsection.link) ?
                                    <a href={subsection.link}>
                                        {subsection.name}
                                    </a> :
                                    <ChakraLink onClick={props.navClose} href={subsection.link}>
                                        {subsection.name}
                                    </ChakraLink>
                            }
                        </ListItem>
                    ))}
                </List>
            </AccordionPanel>
        </AccordionItem>
    );
}

export default NavMenuSection;
