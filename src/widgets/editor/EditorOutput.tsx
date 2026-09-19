import React from 'react';
import { Box, Button, HStack, Select, Text } from '@chakra-ui/react';
import useAppColors from '../../hooks/useAppColors';
import { formatTime, type OutputEntry } from './outputLog';
import { DOCK_OPTIONS, isSideDock, type Dock } from './dock';

interface EditorOutputProps {
  entries: OutputEntry[];
  dock: Dock;
  /** Width when docked left/right, height when docked top/bottom. */
  size: number;
  /** Flex order within the editor body: before the code (0) or after it (2). */
  order: number;
  onDockChange: (dock: Dock) => void;
  onClear: () => void;
  onHide: () => void;
}

/**
 * The editor's output zone: a log of runs, newest at the bottom, each with
 * what it printed and how it ended. It can be docked to any side of the code
 * (the divider between them, in EditorWidget, resizes it); the toolbar's Output
 * button hides it.
 */
const EditorOutput: React.FC<EditorOutputProps> = ({ entries, dock, size, order, onDockChange, onClear, onHide }) => {
  const [colors] = useAppColors();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // follow the newest entry
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);

  return (
    <Box
      order={order}
      flexShrink={0}
      // never let the zone squeeze the code out, however small the widget gets
      {...(isSideDock(dock)
        ? { w: `${size}px`, maxW: 'calc(100% - 120px)', minW: '160px' }
        : { h: `${size}px`, maxH: 'calc(100% - 120px)', minH: '80px' })}
      display="flex"
      flexDirection="column"
      overflow="hidden"
    >
      <HStack px={2} py={1} spacing={2} flexShrink={0} borderBottom="1px solid" borderColor={colors.foreQuarter} minW={0}>
        <Text fontSize="xs" fontWeight={600} color={colors.foreHalf} textTransform="uppercase">
          Output
        </Text>
        <Box flex={1} />
        <Select
          size="xs"
          w="84px"
          aria-label="Dock output"
          title="Dock the output zone"
          value={dock}
          onChange={(e) => onDockChange(e.target.value as Dock)}
          color={colors.fore}
          borderColor={colors.foreQuarter}
        >
          {DOCK_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
        <Button size="xs" variant="ghost" onClick={onClear} isDisabled={entries.length === 0}>
          Clear
        </Button>
        <Button size="xs" variant="ghost" onClick={onHide}>
          Hide
        </Button>
      </HStack>
      <Box ref={scrollRef} flex={1} minH={0} overflow="auto" px={2} py={1} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize="12px">
        {entries.length === 0 ? (
          <Text color={colors.foreHalf}>Run a query to see its output here.</Text>
        ) : (
          entries.map((e) => (
            <Box key={e.id} mb={1}>
              <Text color={e.status === 'error' ? colors.fail : colors.success}>
                <Text as="span" color={colors.foreHalf}>{formatTime(e.at)}  {e.language}  </Text>
                {e.status === 'error' ? '✗' : '✓'} {e.summary}
              </Text>
              {e.text && (e.status === 'ok' || e.text !== e.summary) ? (
                <Text as="pre" whiteSpace="pre-wrap" wordBreak="break-word" color={e.status === 'error' ? colors.fail : colors.fore} pl={2} userSelect="text">
                  {e.text}
                </Text>
              ) : null}
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
};

export default EditorOutput;
