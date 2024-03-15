import React from 'react';
import { VStack, HStack, Grid, GridItem } from '@chakra-ui/layout';
import { MdSettings } from 'react-icons/md';
import { AiFillPushpin, AiFillInfoCircle } from 'react-icons/ai';
import { VscClose } from 'react-icons/vsc';
import { 
    Box, 
    Button, 
    ButtonGroup, 
    Center,
    IconButton,
    Input,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    Select,
    Switch,
    Text,
    useToast,
    useMediaQuery
} from '@chakra-ui/react';
import useAppColors from '../hooks/colors';
import { stopPropagation } from '../hooks/stoppropagation';

const WidgetContainer = ({
    name,
    wKey,
    settings,
    WidgetElement,
    widgetLayout,
    removeWidget,
    toggleStatic,
}) => {
    const colors = useAppColors();


    const [ widgetSettings, setWidgetSettings ] = React.useState(settings);
    const [ widgetElementProps, setWidgetElementProps ] = React.useState(settings);

    const [ settingsIsOpen, setSettingsOpen ] = React.useState(false);
    const [isLargerThan1280] = useMediaQuery('(min-width: 1280px)');
    
    React.useEffect(()=>{
        // overrides if on a phone
        if (!isLargerThan1280 && !widgetLayout.static){
            toggleStatic(wKey)
        }
    }, [])

    return (
        <div style={{height: "100%", width: "100%", maxWidth: "100%", maxHeight: "100%", padding: 5}}>
            <Modal isOpen={settingsIsOpen} onClose={()=>setSettingsOpen(false)}>
                <ModalOverlay />
                <ModalContent 
                    bgColor={colors.bg} 
                    textColor={colors.fore} 
                    fontFamily="courier new" 
                    borderRadius={0}
                    borderColor={colors.fore}
                    borderWidth={1}
                    onMouseDown={stopPropagation}
                    onTouchStart={stopPropagation}
                >
                    <ModalHeader 
                        borderBottomColor={colors.fore} 
                        borderBottomWidth={1} 
                        fontSize={18}
                    >
                        {`${name} Settings`}
                    </ModalHeader>
                    <ModalCloseButton 
                        borderWidth={1} 
                        borderRadius={0} 
                        borderColor={colors.fore}
                        _hover={{bgColor: colors.fore, color: colors.bg}} 
                    />
                    <ModalBody paddingTop={5}>
                        <h3>settings here</h3>
                    </ModalBody>

                    <ModalFooter>
                        <Button
                            variant='outline'
                            borderColor={colors.fore}
                            textColor={colors.fore} 
                            borderRadius={0}
                            // borderBottomRightRadius={10}
                            _hover={{bgGradient: `linear(to-r, ${colors.fore}, ${colors.fore})`, textColor: colors.bg}}
                            _active={{bgGradient: `linear(to-r, ${colors.foreActiveLight}, ${colors.foreActive})`, textColor: colors.bg}}
                        >
                            Save
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
            <VStack h="100%" w="100%"

            >
                <HStack 
                    w="100%"
                    h="20px"
                    borderTopRightRadius={0}
                    borderTopLeftRadius={0}
                >
                    <Text 
                        color={colors.fore} 
                        fontFamily="courier new" 
                        w="100%"
                        fontSize={14}
                        borderTopLeftRadius={5}
                        paddingLeft={2}
                    >
                        {name}
                    </Text>
                    <ButtonGroup 
                        size='xs' 
                        isAttached 
                        alignSelf={"flex-end"}
                        variant='outline'
                        borderColor={colors.fore}
                        onMouseDown={stopPropagation}
                        onTouchStart={stopPropagation}
                    
                    >
                        <IconButton
                            h="20px" 
                            color={colors.fore} 
                            key={`topbar-cog`}
                            onClick={()=>setSettingsOpen(true)}
                            aria-label='rem-widge' 
                            alignSelf={"flex-end"}
                            bg={colors.bg}
                            borderWidth={1}
                            _hover={{bg: colors.fore, color: colors.bg, borderColor: colors.bg}}
                            _active={{bg: colors.foreActive, color: colors.bg, borderColor: colors.bg}}
                            icon={<MdSettings />}
                            isActive={settingsIsOpen}
                            borderColor={colors.bgDark} 
                            borderRadius={0}
                            borderTopRightRadius={0}
                        />
                        <IconButton
                            h="20px" 
                            color={colors.fore} 
                            key={`topbar-pin`}
                            onClick={()=>toggleStatic(wKey)}
                            aria-label='rem-widge' 
                            alignSelf={"flex-end"}
                            bg={colors.bg}
                            borderWidth={1}
                            _hover={{bg: colors.fore, color: colors.bg, borderColor: colors.bg}}
                            _active={{bg: colors.foreActive, color: colors.bg, borderColor: colors.bg}}
                            icon={<AiFillPushpin />}
                            isActive={isLargerThan1280 ? widgetLayout.static : true}
                            disabled={!isLargerThan1280} //cannot move if on phone
                            borderColor={colors.bgDark} 
                            borderRadius={0}
                            borderTopRightRadius={0}
                        />
                        <IconButton
                            h="20px" 
                            color={colors.fore} 
                            key={`topbar-x`}
                            onClick={()=>removeWidget(wKey)}
                            aria-label='rem-widge' 
                            alignSelf={"flex-end"}
                            bg={colors.bg}
                            borderWidth={1}
                            _hover={{bg: "red.400", color: colors.bg}}
                            icon={<VscClose />} 
                            borderColor={colors.bgDark} 
                            borderRadius={0}
                            borderTopRightRadius={0}
                        />
                    </ButtonGroup>
                </HStack>
            <div style={{height: "100%", width: "100%", overflow: "auto"}} id={
                `${wKey}-div-container`
            }>
                <WidgetElement {...widgetElementProps} />
            </div>
            </VStack>
            
        </div>
    )
}

export default WidgetContainer;