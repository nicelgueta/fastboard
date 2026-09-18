import React from 'react';
import {
    Popover,
    PopoverTrigger,
    PopoverContent,
    PopoverArrow,
    PopoverBody,
    PopoverHeader,
    IconButton,
    HStack,
    Box,
    Text,
} from '@chakra-ui/react';
import { MdPalette } from 'react-icons/md';
import useAppColors, { ACCENT_PALETTE } from '../hooks/useAppColors';

// Minimal "Appearance" entry point: an accent-color swatch picker. Color
// mode itself (dark/light) is toggled separately via ColorModeSwitcher.
// Lives in nav-header.tsx next to it. Kept deliberately small since
// Phase 2 rebuilds the nav header layout around this.
const Appearance: React.FC = () => {
    const [colors, setAccentColor] = useAppColors();

    return (
        <Popover placement="bottom-end">
            <PopoverTrigger>
                <IconButton
                    aria-label="appearance-settings"
                    variant="ghost"
                    size="sm"
                    color={colors.fore}
                    icon={<MdPalette size={20} />}
                />
            </PopoverTrigger>
            <PopoverContent
                bg={colors.surfaceAlt}
                borderColor={colors.border}
                borderWidth={1}
                borderRadius="lg"
                color={colors.fore}
                w="auto"
            >
                <PopoverArrow bg={colors.bg} />
                <PopoverHeader borderBottomWidth={1} borderColor={colors.border} fontFamily="courier new">
                    Accent color
                </PopoverHeader>
                <PopoverBody>
                    <HStack spacing={2} wrap="wrap" maxW="180px">
                        {Object.keys(ACCENT_PALETTE).map((name) => (
                            <Box
                                key={name}
                                as="button"
                                aria-label={`accent-${name}`}
                                onClick={() => setAccentColor(name)}
                                w="24px"
                                h="24px"
                                borderRadius="full"
                                bg={
                                    // Recompute directly from the palette so every swatch
                                    // shows its own color, not just the active accent.
                                    `rgb(${ACCENT_PALETTE[name].join(',')})`
                                }
                                borderWidth={name === colors.schemeName ? 2 : 1}
                                borderColor={name === colors.schemeName ? colors.fore : colors.foreQuarter}
                                cursor="pointer"
                            />
                        ))}
                    </HStack>
                    <Text fontSize="xs" mt={2} color={colors.foreHalf}>
                        Current: {colors.schemeName}
                    </Text>
                </PopoverBody>
            </PopoverContent>
        </Popover>
    );
};

export default Appearance;
