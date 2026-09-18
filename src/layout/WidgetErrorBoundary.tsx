import React from 'react';
import { Box, Text, VStack } from '@chakra-ui/react';

interface Props {
    /** Widget name, for the message. */
    name: string;
    children: React.ReactNode;
}

interface State {
    error: Error | null;
}

/**
 * Keeps one widget's failure inside that widget's panel.
 *
 * Widgets are React.lazy (see widgets/registry.ts), and a chunk that fails to
 * load - a stale dev-server cache, a deploy mid-session, a flaky network -
 * throws during render. Without a boundary that unmounts the whole React tree
 * and the entire board goes blank, losing every other widget on it. Suspense
 * only covers the loading state, not the error one.
 */
class WidgetErrorBoundary extends React.Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // Keep the detail in the console - the panel shows the short version.
        console.error(`Widget "${this.props.name}" failed:`, error, info.componentStack);
    }

    render() {
        if (!this.state.error) return this.props.children;
        return (
            <Box p={4} h="100%" overflow="auto">
                <VStack align="flex-start" spacing={2}>
                    <Text fontWeight="bold">This widget failed to load.</Text>
                    <Text fontSize="sm" opacity={0.8}>
                        {this.state.error.message}
                    </Text>
                    <Text fontSize="xs" opacity={0.6}>
                        Close and re-add the widget. If it keeps happening, reload the page -
                        the rest of your board is unaffected.
                    </Text>
                </VStack>
            </Box>
        );
    }
}

export default WidgetErrorBoundary;
