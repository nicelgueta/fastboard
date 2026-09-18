import React from 'react';
import {
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    Tabs,
    TabList,
    TabPanels,
    Tab,
    TabPanel,
    VStack,
    HStack,
    Text,
    Grid,
    GridItem,
    Switch,
    Select,
    Input,
    Slider,
    SliderTrack,
    SliderFilledTrack,
    SliderThumb,
    Box,
} from '@chakra-ui/react';
import useAppColors, { RADIUS } from '../hooks/useAppColors';
import { stopPropagation } from './common';
import FBButton from './primitive/Button';
import { useAppSettings, DEFAULT_TABLE_SETTINGS, StorageBackend } from '../store/appSettings';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

const Row: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => {
    const [colors] = useAppColors();
    return (
        <>
            <GridItem>
                <Text fontSize="sm">{label}</Text>
                {hint ? (
                    <Text fontSize="xs" color={colors.foreHalf}>
                        {hint}
                    </Text>
                ) : null}
            </GridItem>
            <GridItem>{children}</GridItem>
        </>
    );
};

/** App-wide preferences: the cog in the top-right. */
const AppSettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
    const [colors] = useAppColors();
    const table = useAppSettings((s) => s.table);
    const storage = useAppSettings((s) => s.storage);
    const remoteBaseUrl = useAppSettings((s) => s.remoteBaseUrl);
    const setTable = useAppSettings((s) => s.setTable);
    const setStorage = useAppSettings((s) => s.setStorage);
    const setRemoteBaseUrl = useAppSettings((s) => s.setRemoteBaseUrl);
    const reset = useAppSettings((s) => s.reset);

    const controlProps = {
        bg: colors.surface,
        borderColor: colors.border,
        borderRadius: 'md' as const,
        size: 'sm' as const,
        color: colors.fore,
        _hover: { borderColor: colors.borderStrong },
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="2xl" isCentered>
            <ModalOverlay bg={colors.overlay} />
            <ModalContent
                bgColor={colors.surfaceAlt}
                textColor={colors.fore}
                borderRadius={RADIUS.lg}
                borderColor={colors.border}
                borderWidth={1}
                onMouseDown={stopPropagation}
                onTouchStart={stopPropagation}
            >
                <ModalHeader borderBottomColor={colors.border} borderBottomWidth={1} fontSize={16}>
                    Settings
                </ModalHeader>
                <ModalCloseButton borderRadius={RADIUS.md} _hover={{ bgColor: colors.surfaceSubtle }} />
                <ModalBody paddingTop={4}>
                    <Tabs variant="soft-rounded" size="sm" colorScheme="gray">
                        <TabList mb={4} gap={2}>
                            <Tab _selected={{ bg: colors.infoQuarter, color: colors.fore }}>Tables</Tab>
                            <Tab _selected={{ bg: colors.infoQuarter, color: colors.fore }}>Storage</Tab>
                        </TabList>
                        <TabPanels>
                            <TabPanel px={0}>
                                <Grid templateColumns="1fr 1fr" gap={4} alignItems="center">
                                    <Row label="Font size" hint={`ag-grid default ${DEFAULT_TABLE_SETTINGS.fontSize}px`}>
                                        <HStack>
                                            <Slider
                                                min={10}
                                                max={20}
                                                step={1}
                                                value={table.fontSize}
                                                onChange={(v) => setTable({ fontSize: v })}
                                                flex={1}
                                            >
                                                <SliderTrack bg={colors.surfaceSubtle}>
                                                    <SliderFilledTrack bg={colors.info} />
                                                </SliderTrack>
                                                <SliderThumb boxSize={4} />
                                            </Slider>
                                            <Text fontSize="xs" w="34px">{table.fontSize}px</Text>
                                        </HStack>
                                    </Row>
                                    <Row label="Row height" hint={`ag-grid default ${DEFAULT_TABLE_SETTINGS.rowHeight}px`}>
                                        <HStack>
                                            <Slider
                                                min={24}
                                                max={64}
                                                step={2}
                                                value={table.rowHeight}
                                                onChange={(v) => setTable({ rowHeight: v })}
                                                flex={1}
                                            >
                                                <SliderTrack bg={colors.surfaceSubtle}>
                                                    <SliderFilledTrack bg={colors.info} />
                                                </SliderTrack>
                                                <SliderThumb boxSize={4} />
                                            </Slider>
                                            <Text fontSize="xs" w="34px">{table.rowHeight}px</Text>
                                        </HStack>
                                    </Row>
                                    <Row label="Header height" hint={`ag-grid default ${DEFAULT_TABLE_SETTINGS.headerHeight}px`}>
                                        <HStack>
                                            <Slider
                                                min={28}
                                                max={72}
                                                step={2}
                                                value={table.headerHeight}
                                                onChange={(v) => setTable({ headerHeight: v })}
                                                flex={1}
                                            >
                                                <SliderTrack bg={colors.surfaceSubtle}>
                                                    <SliderFilledTrack bg={colors.info} />
                                                </SliderTrack>
                                                <SliderThumb boxSize={4} />
                                            </Slider>
                                            <Text fontSize="xs" w="34px">{table.headerHeight}px</Text>
                                        </HStack>
                                    </Row>
                                    <Row label="Rows per page" hint="Default for new tables">
                                        <Select
                                            {...controlProps}
                                            value={table.defaultPageSize}
                                            onChange={(e) => setTable({ defaultPageSize: Number(e.target.value) })}
                                        >
                                            {[10, 25, 50, 100, 250, 500].map((n) => (
                                                <option key={n} value={n}>{n}</option>
                                            ))}
                                        </Select>
                                    </Row>
                                    <Row label="Zebra striping">
                                        <Switch
                                            isChecked={table.stripeRows}
                                            onChange={(e) => setTable({ stripeRows: e.target.checked })}
                                        />
                                    </Row>
                                    <Row label="Column separators">
                                        <Switch
                                            isChecked={table.columnBorders}
                                            onChange={(e) => setTable({ columnBorders: e.target.checked })}
                                        />
                                    </Row>
                                    <Row label="Monospace cells" hint="Easier to scan numeric columns">
                                        <Switch
                                            isChecked={table.monospaceCells}
                                            onChange={(e) => setTable({ monospaceCells: e.target.checked })}
                                        />
                                    </Row>
                                </Grid>
                            </TabPanel>

                            <TabPanel px={0}>
                                <VStack align="stretch" spacing={4}>
                                    <Grid templateColumns="1fr 1fr" gap={4} alignItems="center">
                                        <Row label="Saved boards & layouts" hint="Where boards and saved tools are stored">
                                            <Select
                                                {...controlProps}
                                                value={storage}
                                                onChange={(e) => setStorage(e.target.value as StorageBackend)}
                                            >
                                                <option value="local">This browser (localStorage)</option>
                                                <option value="remote">Server</option>
                                            </Select>
                                        </Row>
                                        {storage === 'remote' ? (
                                            <Row label="Base path" hint="boards → <base>/boards">
                                                <Input
                                                    {...controlProps}
                                                    value={remoteBaseUrl}
                                                    onChange={(e) => setRemoteBaseUrl(e.target.value)}
                                                    placeholder="/app"
                                                />
                                            </Row>
                                        ) : null}
                                    </Grid>
                                    <Box
                                        borderWidth={1}
                                        borderColor={colors.border}
                                        borderRadius={RADIUS.md}
                                        bg={colors.surfaceSubtle}
                                        p={3}
                                    >
                                        <Text fontSize="xs" color={colors.foreHalf}>
                                            {storage === 'local'
                                                ? 'Boards live only in this browser. Clearing site data loses them, and nothing is uploaded anywhere.'
                                                : `Reads and writes ${remoteBaseUrl.replace(/\/$/, '')}/boards, /layoutConfigs and /savedWidgets. If the server does not answer, FastBoard falls back to this browser's storage rather than losing anything.`}
                                        </Text>
                                    </Box>
                                </VStack>
                            </TabPanel>
                        </TabPanels>
                    </Tabs>
                </ModalBody>
                <ModalFooter gap={2}>
                    <FBButton typ="warning" variant="ghost" size="sm" onClick={reset}>
                        Reset to defaults
                    </FBButton>
                    <FBButton typ="info" size="sm" onClick={onClose}>
                        Done
                    </FBButton>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default AppSettingsModal;
