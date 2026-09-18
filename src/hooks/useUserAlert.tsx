import {
    Center,
    HStack,
    IconButton,
    Text,
    VStack,
    useToast
} from '@chakra-ui/react';
import useAppColors, { RADIUS } from './useAppColors';
import React from 'react';
import { VscClose } from 'react-icons/vsc';

import { componentType } from '../interfaces';

interface ToastProps {
    title: string;
    status: componentType;
    description?: string;
    onClose: () => void;
}

const ToastComponent: React.FC<ToastProps> = ({ 
    title, 
    description, 
    status,
    onClose 
}) => {
    const [colors] = useAppColors();

    const getBgColor = (status: componentType) => {
        // Near-opaque so the toast reads clearly over whatever's behind it,
        // rather than the faint wash that made status hard to tell at a glance.
        return colors[`${status}Dark`]
    }

    const getBorderColor = (status: componentType) => {
        return colors[status]
    }

    return (
        <Center
            w={"100%"}
            padding={2}
            bgColor={getBgColor(status)}
            textColor={colors.foreLight}
            borderColor={getBorderColor(status)}
            borderWidth={1}
            borderRadius={RADIUS.lg}
            boxShadow="lg"
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
                        borderRadius={RADIUS.md}
                        variant="ghost"
                        _hover={{ bgColor: colors.foreQuarter }}
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
const useUserAlert = () => {
    const toast = useToast();

    const customToast = (
        title: string, 
        status: componentType,
        description?: string
    ) => {
        toast({
            render: ({id, onClose}) => ToastComponent({ title, status, description, onClose }),
            position: "bottom",
            duration: 5000,
            isClosable: true,
        });
    }

    return customToast;
}

export default useUserAlert;