import React from 'react';
import { Box, Button, Flex, Heading, HStack, SimpleGrid, Text, VStack } from '@chakra-ui/react';
import { useLocation } from 'wouter';
import { MdTableChart, MdCode, MdHub } from 'react-icons/md';
import useAppColors, { RADIUS } from '../hooks/useAppColors';
import { ColorModeSwitcher } from '../components/ColorModeSwitcher';
import IntroModal from '../intro/IntroModal';
import useIntro from '../intro/useIntro';
import SceneBoundary from './SceneBoundary';
import { hasWebGL, usePrefersReducedMotion } from './webgl';

// three.js and the scene are their own chunk: the copy and buttons paint first.
const Scene = React.lazy(() => import('./Scene'));

const FEATURES = [
    {
        icon: MdTableChart,
        title: 'Data tables',
        body: 'Drop in a CSV, JSON or Parquet file. Sort, page and build nested filters without writing a query.',
    },
    {
        icon: MdCode,
        title: 'SQL & qpl editor',
        body: 'Write DuckDB SQL or qpl in a real code editor and send the result straight into a linked table.',
    },
    {
        icon: MdHub,
        title: 'Catalog graph',
        body: 'See every loaded database, table and column as a 3D graph you can rotate, search and click through.',
    },
];

const Landing: React.FC = () => {
    const [colors] = useAppColors();
    const [, navigate] = useLocation();
    const reducedMotion = usePrefersReducedMotion();
    // checked once: a context that can't be created now won't appear later
    const [webgl] = React.useState(hasWebGL);
    const intro = useIntro(false);

    // Whatever the scene does (still loading, WebGL missing, crashed, reduced
    // motion), this gradient is behind it, so the page is never blank.
    const gradient =
        `radial-gradient(60% 55% at 18% 22%, ${colors.infoQuarter}, transparent), ` +
        `radial-gradient(55% 50% at 82% 78%, ${colors.successQuarter}, transparent), ${colors.bg}`;

    const openBoard = (e: React.MouseEvent) => {
        // let ctrl/cmd/middle-click open the board in a new tab as a link would
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate('/board');
    };

    return (
        <Box position="relative" h="100%" w="100%" overflowY="auto" overflowX="hidden" color={colors.fore} bg={colors.bg}>
            <title>FastBoard</title>
            <IntroModal isOpen={intro.open} setIsOpen={intro.setOpen} onDismiss={intro.dismiss} />

            <Box aria-hidden position="fixed" inset={0} zIndex={0} pointerEvents="none" backgroundImage={gradient}>
                {webgl ? (
                    <SceneBoundary fallback={null}>
                        <React.Suspense fallback={null}>
                            <Scene animate={!reducedMotion} />
                        </React.Suspense>
                    </SceneBoundary>
                ) : null}
            </Box>

            <Flex position="relative" zIndex={1} direction="column" minH="100%" px={{ base: 4, md: 8 }} py={4}>
                <HStack justify="space-between">
                    <Text fontWeight={700} letterSpacing="-0.01em">FastBoard</Text>
                    <ColorModeSwitcher aria-label="Toggle colour mode" color={colors.fore} />
                </HStack>

                <Flex flex={1} align="center" justify="center" py={10}>
                    <VStack
                        spacing={6}
                        textAlign="center"
                        maxW="720px"
                        px={{ base: 5, md: 10 }}
                        py={{ base: 8, md: 12 }}
                        bg={colors.bg3Quarter}
                        borderWidth={1}
                        borderColor={colors.border}
                        borderRadius={RADIUS.xl}
                        backdropFilter="blur(8px)"
                    >
                        <Heading as="h1" fontSize={{ base: '4xl', md: '6xl' }} letterSpacing="-0.03em" lineHeight={1.05}>
                            Build dashboards
                            <br />
                            from windows.
                        </Heading>
                        <Text fontSize={{ base: 'md', md: 'lg' }} color={colors.fore3Quarter}>
                            FastBoard is a dashboard made of independent widgets you dock, split and float
                            however you like. Tables, SQL and a 3D data catalog, all running in your browser.
                        </Text>
                        <HStack spacing={3} wrap="wrap" justify="center">
                            <Button
                                as="a"
                                href={`${import.meta.env.BASE_URL}board`}
                                onClick={openBoard}
                                size="lg"
                                bg={colors.info}
                                color={colors.bgDark}
                                borderRadius={RADIUS.md}
                                _hover={{ bg: colors.infoLight }}
                            >
                                Open dashboard
                            </Button>
                            <Button
                                size="lg"
                                variant="outline"
                                borderColor={colors.borderStrong}
                                color={colors.fore}
                                borderRadius={RADIUS.md}
                                _hover={{ bg: colors.surfaceSubtle }}
                                onClick={() => intro.setOpen(true)}
                            >
                                How it works
                            </Button>
                        </HStack>
                    </VStack>
                </Flex>

                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} maxW="1000px" w="100%" mx="auto">
                    {FEATURES.map(({ icon: Icon, title, body }) => (
                        <VStack
                            key={title}
                            align="flex-start"
                            spacing={2}
                            p={5}
                            bg={colors.bg3Quarter}
                            borderWidth={1}
                            borderColor={colors.border}
                            borderRadius={RADIUS.lg}
                            backdropFilter="blur(8px)"
                        >
                            <Box color={colors.info}><Icon size={24} /></Box>
                            <Text fontWeight={600}>{title}</Text>
                            <Text fontSize="sm" color={colors.fore3Quarter}>{body}</Text>
                        </VStack>
                    ))}
                </SimpleGrid>

                <Text textAlign="center" fontSize="xs" color={colors.foreHalf} pt={6} pb={2}>
                    Nothing is uploaded: your files, queries and boards stay in this browser.
                </Text>
            </Flex>
        </Box>
    );
};

export default Landing;
