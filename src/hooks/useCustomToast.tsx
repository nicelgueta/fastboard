import {
    Center,
    HStack,
    IconButton,
    Text,
    VStack,
    useToast
} from '@chakra-ui/react';
import useAppColors from './colors';
import React from 'react';
import { VscClose } from 'react-icons/vsc';

type status = 'info' | 'warning' | 'success' | 'fail';

interface ToastProps {
    title: string;
    status: status;
    description?: string;
    onClose: () => void;
}

const ToastComponent: React.FC<ToastProps> = ({ 
    title, 
    description, 
    status,
    onClose 
}) => {
    const colors = useAppColors();

    const getBgColor = (status: status) => {
        switch (status) {
            case 'info':
                return colors.infoHalf;
            case 'warning':
                return colors.warningHalf;
            case 'success':
                return colors.successHalf;
            case 'fail':
                return colors.failHalf;
        }
    }

    const getBorderColor = (status: status) => {
        switch (status) {
            case 'info':
                return colors.info;
            case 'warning':
                return colors.warning;
            case 'success':
                return colors.success;
            case 'fail':
                return colors.fail;
        }
    }

    return (
        <Center
            w={"100%"}
            padding={2}
            bgColor={getBgColor(status)}
            textColor={colors.fore}
            borderColor={getBorderColor(status)}
            borderWidth={1}
            borderRadius={0}
        >
            <VStack 
                h={"100%"}
                w={"100%"}
            >
                <HStack
                    w={"100%"}
                    justifyContent={"space-between"}
                >
                    <Text
                        w={"100%"}
                        textAlign={"center"}
                        fontWeight={"bold"}
                    >
                        {title}
                    </Text>
                    <IconButton
                        borderColor={colors.fore}
                        borderRadius={0}
                        borderWidth={1}
                        _hover={{
                            bgColor: colors.fore,
                            color: colors.bg
                        }}
                        size={"xs"}
                        aria-label="Close"
                        icon={<VscClose />}
                        onClick={onClose}
                    />
                </HStack>
                {
                    description &&
                    <Text>
                        {description}
                    </Text>
                }
            </VStack>
        </Center>
    )
}
const useCustomToast = () => {
    const toast = useToast();

    const customToast = (
        title: string, 
        status: status,
        description?: string
    ) => {
        toast({
            render: ({id, onClose}) => ToastComponent({ title, status, description, onClose }),
            position: "top",
            duration: 5000,
            isClosable: true,
        });
    }

    return customToast;
}

export default useCustomToast;