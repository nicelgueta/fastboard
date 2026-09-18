import React from 'react';
import { Text, VStack, ListItem, UnorderedList, Code } from '@chakra-ui/react';
import { Colors } from '../hooks/useAppColors';

export interface IntroStep {
  title: string;
  render: (colors: Colors) => React.ReactNode;
}

// Content here describes the app as it exists after Phase 2 (dropdown tool
// menus, not the old TextSearch boxes). Verify against nav/nav-header.tsx,
// nav/ToolMenu.tsx, layout/Main.tsx (getTabContextMenuItems) and
// layout/GroupHeaderActions.tsx before changing any of this copy.
export const INTRO_STEPS: IntroStep[] = [
  {
    title: 'What this is',
    render: (colors) => (
      <VStack align="flex-start" spacing={3}>
        <Text color={colors.fore}>
          FastBoard is a dashboard of independent widgets that you arrange yourself. There is no
          fixed layout — you add the tools you want, dock and resize them however suits you, and
          save the result as a board you can reload later.
        </Text>
        <Text color={colors.fore}>
          This walkthrough covers the basics in a few short steps. You can reopen it any time from
          the help icon in the header.
        </Text>
      </VStack>
    ),
  },
  {
    title: 'Adding tools',
    render: (colors) => (
      <VStack align="flex-start" spacing={3}>
        <Text color={colors.fore}>
          Open the <Code>Add tool</Code> dropdown in the header. It opens showing every available
          widget — type to filter, or just scroll. Selecting an item adds it to the board
          immediately, no separate add step.
        </Text>
        <Text color={colors.fore}>
          Widgets that already have the maximum number of instances on the board show as disabled
          in the list, with a "max reached" label, so you don't hit a failed-to-add error after the
          fact.
        </Text>
      </VStack>
    ),
  },
  {
    title: 'Arranging',
    render: (colors) => (
      <VStack align="flex-start" spacing={3}>
        <Text color={colors.fore}>
          The layout is powered by dockview. Drag a tab to an edge of another panel to split the
          board, or onto the middle of a panel to dock alongside its other tabs. Drag a tab out
          into empty space to float it above the board.
        </Text>
        <Text color={colors.fore}>Right-click any tab for its actions menu:</Text>
        <UnorderedList pl={4} color={colors.fore} spacing={1}>
          <ListItem>Rename</ListItem>
          <ListItem>Settings</ListItem>
          <ListItem>Save As</ListItem>
          <ListItem>Lock / Unlock</ListItem>
          <ListItem>Maximize</ListItem>
          <ListItem>Float</ListItem>
          <ListItem>Pop out</ListItem>
          <ListItem>Close / Close Others / Close All</ListItem>
        </UnorderedList>
        <Text color={colors.fore}>
          Each panel group also has its own pop-out icon at the left of its tab strip, which pops
          the whole group — every tab in it — into its own browser window.
        </Text>
      </VStack>
    ),
  },
  {
    title: 'Configuring tools',
    render: (colors) => (
      <VStack align="flex-start" spacing={3}>
        <Text color={colors.fore}>
          Right-click a tab and choose <Code>Settings</Code> to configure that widget instance.
        </Text>
        <Text color={colors.fore}>
          Once a widget is configured the way you want it, right-click it and choose{' '}
          <Code>Save As</Code> to store that configuration for reuse. It will then show up in the{' '}
          <Code>Saved tools</Code> dropdown in the header, ready to drop onto any board.
        </Text>
      </VStack>
    ),
  },
  {
    title: 'Saving a board',
    render: (colors) => (
      <VStack align="flex-start" spacing={3}>
        <Text color={colors.fore}>
          Use the save icons in the header to save the current layout as a board: the plain save
          icon saves over the currently loaded board, and "Save As" saves it under a new name. The{' '}
          <Code>Boards</Code> dropdown (hotkey <Code>1</Code>) reloads any saved board.
        </Text>
        <Text color={colors.fore} fontWeight="bold">
          Boards, saved widgets and all your preferences are stored only in this browser's
          localStorage. Nothing is uploaded anywhere. Clearing your browser's site data for
          FastBoard will permanently lose them.
        </Text>
      </VStack>
    ),
  },
  {
    title: 'Linking widgets',
    render: (colors) => (
      <VStack align="flex-start" spacing={3}>
        <Text color={colors.fore}>
          FastBoard is being built towards letting widgets talk to each other — for example,
          querying a table widget's data directly from a code editor widget.
        </Text>
        <Text color={colors.fore} fontStyle="italic">
          This linking is not available yet in this build. It's on the roadmap — this step is here
          so the idea isn't a surprise later.
        </Text>
      </VStack>
    ),
  },
];
