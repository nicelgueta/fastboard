import React from 'react';
import { Text, VStack, ListItem, UnorderedList, OrderedList, Code, Kbd } from '@chakra-ui/react';
import { Colors } from '../hooks/useAppColors';

export interface IntroStep {
  title: string;
  render: (colors: Colors) => React.ReactNode;
}

// The copy here describes the app as it is now. Verify against the code before
// changing any of it, and bump INTRO_VERSION in IntroModal.tsx when a change is
// significant enough that returning users should see the walkthrough again:
//   - header controls ........ nav/nav-header.tsx, nav/ToolMenu.tsx, nav/BoardMenu.tsx
//   - tab right-click menu ... layout/Main.tsx (getTabContextMenuItems), layout/WidgetTab.tsx
//   - group pop-out .......... layout/GroupHeaderActions.tsx
//   - placement prompt ....... layout/DockPlacementModal.tsx
//   - settings & storage ..... components/AppSettingsModal.tsx, store/storage.ts
//   - table widget ........... widgets/table/TableWidget.tsx, data/engines.ts
//   - editor widget .......... widgets/editor/EditorWidget.tsx
//   - graph widget ........... widgets/graph/GraphWidget.tsx, widgets/graph/config.ts
export const INTRO_STEPS: IntroStep[] = [
  {
    title: 'What this is',
    render: (colors) => (
      <VStack align="flex-start" spacing={3}>
        <Text color={colors.fore}>
          FastBoard is a dashboard of independent widgets that you arrange yourself. There is no
          fixed layout: you add the tools you want, dock and resize them however suits you, and
          save the result as a board you can reload later.
        </Text>
        <Text color={colors.fore}>
          It is built around data. Load a file into a table, query it with SQL, and explore
          everything you have loaded as a 3D graph. All of it runs in your browser, with no server
          behind it.
        </Text>
        <Text color={colors.fore}>
          This walkthrough covers the basics in a few short steps. Reopen it any time from the help
          icon in the header; the app name at the top left takes you back to the home page.
        </Text>
      </VStack>
    ),
  },
  {
    title: 'Adding tools',
    render: (colors) => (
      <VStack align="flex-start" spacing={3}>
        <Text color={colors.fore}>
          Open the <Code>Add to board</Code> menu in the header (or press <Kbd>1</Kbd>). It opens
          showing every available tool with a short description. Type to filter, use the arrow keys
          and <Kbd>Enter</Kbd>, or just click. Choosing an item adds it straight away.
        </Text>
        <Text color={colors.fore}>
          Tools that already have their maximum number of instances on the board are greyed out in
          the list, so you don't hit an error after the fact. Configurations you saved yourself
          appear in the same menu under <Code>Saved</Code>.
        </Text>
        <Text color={colors.fore}>
          When the board already has something on it, you are asked where the new tool should go:
          the top, bottom, left or right of the board, or as another tab.
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
          into empty space to float it above the board. Double-click a tab's title to rename it.
        </Text>
        <Text color={colors.fore}>Right-click any tab for its actions menu:</Text>
        <UnorderedList pl={4} color={colors.fore} spacing={1}>
          <ListItem>Rename</ListItem>
          <ListItem>Settings</ListItem>
          <ListItem>Save As</ListItem>
          <ListItem>Lock / Unlock (disables the widget's controls and stops other tabs docking into it)</ListItem>
          <ListItem>Maximize</ListItem>
          <ListItem>Float</ListItem>
          <ListItem>Pop out</ListItem>
          <ListItem>Close / Close Others / Close All</ListItem>
        </UnorderedList>
        <Text color={colors.fore}>
          Each panel group also has its own pop-out icon at the left of its tab strip, which pops
          the whole group, every tab in it, into its own browser window.
        </Text>
      </VStack>
    ),
  },
  {
    title: 'Configuring tools',
    render: (colors) => (
      <VStack align="flex-start" spacing={3}>
        <Text color={colors.fore}>
          Right-click a tab and choose <Code>Settings</Code> to configure that widget. What you
          can change depends on the tool: page size for a table, the starting depth of the graph,
          and so on.
        </Text>
        <Text color={colors.fore}>
          Once a widget is set up the way you want it, right-click it and choose{' '}
          <Code>Save As</Code> to store that configuration for reuse. It then shows up under{' '}
          <Code>Saved</Code> in the <Code>Add to board</Code> menu, ready to drop onto any board.
        </Text>
        <Text color={colors.fore}>
          The header also holds the accent colour, the light/dark switch and an app{' '}
          <Code>Settings</Code> dialog with table display defaults and where boards are stored.
        </Text>
      </VStack>
    ),
  },
  {
    title: 'Saving a board',
    render: (colors) => (
      <VStack align="flex-start" spacing={3}>
        <Text color={colors.fore}>
          The board's name in the header is a menu. From it you can open, save, save under a new
          name, rename or delete boards, and start a new one. A small dot next to the name means
          there are unsaved changes.
        </Text>
        <Text color={colors.fore} fontWeight="bold">
          By default, boards, saved tools and your preferences are stored only in this browser's
          localStorage. Nothing is uploaded anywhere, and clearing your browser's site data for
          FastBoard will permanently lose them. (If you switch storage to a remote backend in
          Settings, boards go to that instead.)
        </Text>
        <Text color={colors.fore}>
          A board remembers its layout and each widget's settings, and which table a widget was
          using. It does not keep the data itself; see the next step.
        </Text>
      </VStack>
    ),
  },
  {
    title: 'Loading data',
    render: (colors) => (
      <VStack align="flex-start" spacing={3}>
        <Text color={colors.fore}>
          Add a <Code>Data Table</Code>. Pick an engine, then use <Code>Upload file…</Code> to load
          a file into it, or type the name of a table that already exists and press <Code>Load</Code>.
        </Text>
        <UnorderedList pl={4} color={colors.fore} spacing={1}>
          <ListItem>
            <b>DuckDB</b> takes CSV, JSON and Parquet, is queried with SQL, and supports the
            table's <Code>Filter</Code> builder for nested and/or/not conditions.
          </ListItem>
          <ListItem>
            <b>qpl</b> takes CSV and Parquet and is queried with the qpl language. Its tables don't
            have the Filter builder; filter with a qpl query instead.
          </ListItem>
        </UnorderedList>
        <Text color={colors.fore}>
          Click a column header to sort, and use the page controls at the bottom to move through
          large tables. Your files are read locally and never leave the browser.
        </Text>
        <Text color={colors.fore} fontStyle="italic">
          Loaded data lives in memory only. After a reload, a restored table widget will ask you to
          upload its file again.
        </Text>
      </VStack>
    ),
  },
  {
    title: 'Linking widgets',
    render: (colors) => (
      <VStack align="flex-start" spacing={3}>
        <Text color={colors.fore}>
          Widgets can be connected. The clearest example is querying a table from a{' '}
          <Code>Code Editor</Code>:
        </Text>
        <OrderedList pl={4} color={colors.fore} spacing={1}>
          <ListItem>Add a Data Table and load a file into it.</ListItem>
          <ListItem>
            Add a Code Editor and choose that table in its <Code>Target table widget</Code> list.
            The status next to the Run button changes to <Code>Connected</Code>, and the editor
            switches to the language that table's engine understands (SQL or qpl).
          </ListItem>
          <ListItem>
            Write a query using the table's name. In SQL, the editor suggests table and column
            names as you type.
          </ListItem>
          <ListItem>
            Press <Kbd>Ctrl</Kbd>/<Kbd>Cmd</Kbd>+<Kbd>Enter</Kbd> or <Code>Run</Code>. The result
            appears in the linked table, and the editor's <Code>Output</Code> zone shows the row
            count, timing and any error message.
          </ListItem>
        </OrderedList>
        <Text color={colors.fore}>
          While a query result is showing, the table says which editor produced it. Press{' '}
          <Code>Unlink</Code> on the table to go back to the original data. A table is linked to
          one editor at a time, and if the linked table is closed the editor says so instead of
          failing.
        </Text>
      </VStack>
    ),
  },
  {
    title: 'Exploring the catalog',
    render: (colors) => (
      <VStack align="flex-start" spacing={3}>
        <Text color={colors.fore}>
          The <Code>3D Catalog Graph</Code> draws everything loaded into DuckDB as a graph:
          databases, schemas, tables and columns, each connected to what contains it. Every node
          carries its name, and columns are coloured by data type (text, number, boolean,
          date/time, nested); the legend at the bottom left is the key. Tables you load appear
          automatically; press <Code>Refresh</Code> after creating one from SQL.
        </Text>
        <UnorderedList pl={4} color={colors.fore} spacing={1}>
          <ListItem>Drag to rotate, scroll to zoom, hover a node for its name.</ListItem>
          <ListItem>Click a node to select it and see its details (types, sizes, and so on).</ListItem>
          <ListItem>Double-click or right-click a node to fly the camera to it; <Code>Fit</Code> frames everything.</ListItem>
          <ListItem>Type in the search box to highlight matching nodes and fade the rest.</ListItem>
          <ListItem>
            The <Code>Labels</Code> button turns names on or off. On big graphs column names show
            only around the selected node, so the view stays readable.
          </ListItem>
          <ListItem>
            Use the depth selector to show fewer levels. Very large catalogs (over 5,000 nodes) ask
            before drawing, because 3D layouts get slow.
          </ListItem>
        </UnorderedList>
      </VStack>
    ),
  },
];
