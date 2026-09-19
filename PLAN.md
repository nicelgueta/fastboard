# FastBoard Revamp — Implementation Plan

Execution plan for the brief in [re-vamp-plan.md](re-vamp-plan.md). Written to be handed to
implementation subagents: each phase below is a self-contained brief with the context,
exact library versions, API shapes and acceptance criteria needed to implement it without
re-deriving the codebase.

**Read Section 1–3 before starting any phase. Then implement only your assigned phase.**

---

## 1. What FastBoard is today

A CRA (react-scripts 5) React 18 + TypeScript app. `src/FastBoard.tsx` is the root component;
`src/index.tsx` mounts it with a hard-coded widget set. It is currently half library, half demo —
`src/_index.ts` exports a library surface that nothing consumes.

### Architecture as it stands

```
src/index.tsx            mounts <FastBoard widgetConfig={...} widgetComponentMapping={...} />
  └ FastBoard.tsx        RecoilRoot + ChakraProvider (forced dark) + <DashboardContainer>
      └ layout/Main.tsx  THE central file. Owns dockview, the widget list, add/remove,
                         board save/load, and the tab context menu.
          ├ nav/nav-header.tsx   top bar: 3x <TextSearch> (board / new tool / saved tool) + save buttons
          ├ nav/nav.tsx          left drawer (nav/config.ts drives it; currently just "Home")
          └ DockviewReact
              ├ components={{ widget: WidgetPanel }}   ← every widget uses ONE renderer
              ├ leftHeaderActionsComponent={GroupHeaderActions}   (pop-out button)
              └ getTabContextMenuItems={...}   (Rename / Settings / Save As / Lock / maximize / float / popout / close)
```

### The concepts you must not break

- **`BaseWidgetDict`** (`src/interfaces.ts:36`) — the static declaration of a widget type:
  `type`, `name`, `description`, `maxNo`, `settings: WidgetSetting[]`, `defaultLayout`.
  Every widget ships one of these next to its component (see `TradingViewChartConfig` in
  `src/example_widgets/tradingview.tsx:49`).
- **`WidgetSetting`** (`src/interfaces.ts:21`) — a declarative settings field. `type` is one of
  `input | number | select | switch | multiSelect | slider | textarea | date`, resolved to a
  primitive component by `SettingsMap` in `src/components/Settings.tsx:15`. The settings modal is
  generated from this array — **widgets never hand-roll their own settings UI.**
- **Panel params are the serialization unit.** `WidgetPanelParams` (`src/layout/types.ts:6`) is
  stored on the dockview panel and round-trips through `dockviewApi.toJSON()/fromJSON()`. Anything
  a widget needs to be restored from a saved board must live there (or in `widgetStates`).
- **`wKey`** — a widget instance id, `` `${type}-${Date.now()}` ``, generated in
  `Main.tsx:184`. It is the dockview panel id and the key into `AllWidgetStates`. It is the
  handle the widget-linking framework (Phase 4) is built on.
- **`useKvStore(storeName)`** (`src/hooks/useKvStore.ts`) — localStorage KV with a `get/set/list`
  API, namespaced `kvstore-<store>-<key>`, with a master index at `allKvStoreKeys`. Stores in use:
  `allBoards`, `saved_widgets`.
- **`useAppColors()`** (`src/hooks/useAppColors.ts`) — returns a semantic palette (`bg`, `fore`,
  `info`, `success`, `warning`, `fail`, each with `3Quarter/Half/Quarter/Barely/Light/Dark`
  variants) for the active Chakra color mode. **All new UI uses these tokens, never raw hex.**
- **`useUserAlert()`** — toast helper: `alert(title, 'success'|'fail'|'warning'|'info', description?)`.
- **`stopPropagation`** (`src/components/common.ts`) — must be wired to `onMouseDown`/`onTouchStart`
  on any interactive surface inside a dockview panel, or dockview eats the click as a drag.

### Known defects to fix in passing (Phase 0)

| Defect | Detail |
|---|---|
| `lodash` undeclared | `src/components/TextSearch.tsx:2` imports it and uses `_.filter` at line 244, but it is **not in `package.json`**. It only resolves today via react-scripts' transitive tree. A clean install or the Vite move breaks it. |
| Missing `manifest.json` | `public/index.html` links `%PUBLIC_URL%/manifest.json`; the file does not exist → 404. |
| Legacy mount | `src/index.tsx:23` uses `ReactDOM.render`, deprecated in React 18. |
| `target: "es5"` | `tsconfig.json` — incompatible with duckdb-wasm / apache-arrow. |
| Dead `MdAirlineSeatIndividualSuite` import | `src/components/TextSearch.tsx:17`. |

---

## 2. Locked decisions

These were decided with the repo owner. Do not revisit them.

| Decision | Choice | Consequence |
|---|---|---|
| Product shape | **Standalone app** | The front page, intro modal and built-in widgets ship as one deployable app. `src/_index.ts` library exports are dropped. |
| Build tool | **Vite** | Phase 0 migrates off react-scripts. Everything else depends on it. |
| Data sources | **Browser-only, duckdb-wasm** | No backend. The `DataSource` contract is still defined as a pluggable interface so a remote impl can be added later; duckdb-wasm is the reference implementation. |
| Grid | **ag-grid-community** (MIT) | Client-side row model only. No row grouping, pivot, master-detail or server-side row model. |
| React | **Stays on 18.2** | Constrains the three.js stack — see Phase 9. Do not upgrade to React 19; Chakra v2 and the R3F v8 line are the tested combination here. |
| State | **Recoil → Zustand** | Recoil's last publish was 2023-03-01 and it is effectively unmaintained. Phase 4 rewrites the store since it is rebuilding it anyway. |

### Verified dependency baseline

Versions below were checked against the npm registry on 2026-09-18 and their peer ranges verified.
Pin these; do not "upgrade to latest" without re-checking peers.

```jsonc
// added in Phase 0
"vite": "^8.3.0",                    // engines: node ^20.19 || >=22.12 — local node is v24.20, OK
"@vitejs/plugin-react": "^6.1.1",
"lodash": "^4.17.21", "@types/lodash": "^4.17.0",   // fixes the undeclared import

// Phase 4
"zustand": "^5.0.15",

// Phase 5/6 — duckdb pins apache-arrow ^17, NOT 21. Mismatched arrow = broken result decoding.
"@duckdb/duckdb-wasm": "^1.32.0",
"apache-arrow": "^17.0.0",
"ag-grid-community": "^36.2.0",
"ag-grid-react": "^36.2.0",

// Phase 7
"monaco-editor": "^0.56.0",
"@monaco-editor/react": "^4.7.0",

// Phase 8
"react-force-graph-3d": "^1.29.1",

// Phase 9 — implemented on plain three.js. R3F (v9 needs React >=19, v8 is the React 18 line) was tried and
// dropped: its global JSX typings overflow TypeScript on Chakra components app-wide. See Phase 9.
"three": "^0.186.0",          // one copy: 3d-force-graph needs >=0.179, so the app follows it
"three-spritetext": "^1.10.0",  // graph node labels
"@types/three": "^0.186.0",

// Phase 2/9
"wouter": "^3.11.0"                  // upgrade from the installed 2.12
```

---

## 3. Target architecture

```
/index.html                  (moved out of public/, Vite entry)
vite.config.ts
src/
  main.tsx                   entry: createRoot + <Router>
  App.tsx                    routes: "/" → <Landing>, "/board" → <FastBoard>
  theme.ts                   dark+light, default dark, persisted           [Phase 1]
  landing/                   three.js front page                           [Phase 9]
  intro/IntroModal.tsx       first-run walkthrough                         [Phase 3]
  nav/
    ToolMenu.tsx             searchable dropdown replacing TextSearch      [Phase 2]
    nav-header.tsx           rebuilt top bar                               [Phase 2]
  store/
    widgetStore.ts           zustand: registry + states + link bus         [Phase 4]
  data/
    types.ts                 DataSource contract, Expression AST           [Phase 5]
    duckdb/                  runtime singleton + DuckDbDataSource          [Phase 5]
  widgets/
    table/                   ag-grid widget + ExpressionBuilder modal      [Phase 6]
    editor/                  Monaco + duckdb SQL                           [Phase 7]
    graph/                   3d catalog explorer                           [Phase 8]
    registry.ts              built-in widgetConfig + componentMapping
  layout/ components/ hooks/ modals/    (existing, largely unchanged)
```

### Conventions every phase follows

1. **Colors** come from `useAppColors()`. Never hard-code hex outside `useAppColors.ts` and `theme.ts`.
2. **Widget settings** are declared as `WidgetSetting[]` on the widget's config export and rendered
   by the existing `SettingsModal`. If a setting genuinely cannot be expressed declaratively (the
   expression builder is the one case), open a dedicated modal from a control inside the widget body —
   do not fork `SettingsModal`.
3. **Every new widget exports** a default React component typed `React.FC<YourProps>` where
   `YourProps extends WidgetElementProps`, plus a named `XxxConfig: BaseWidgetDict`. Register both in
   `src/widgets/registry.ts`.
4. **Heavy widgets lazy-load.** duckdb, Monaco and three.js must be behind `React.lazy` +
   `<Suspense>` so the landing page and an empty board stay light.
5. **Respect `isStatic`** (`props.isStatic`, true when the dockview group is locked) — disable edit
   affordances when set.
6. TypeScript must pass with `strict` off but `strictNullChecks` on (current setting). Do not
   introduce `any` on public contracts (`DataSource`, `Expression`, store APIs).
7. Each phase ends with a working `yarn build` and a manual smoke test. State in your report what
   you actually verified versus what you did not.

### Phase dependency graph

```
Phase 0 (Vite)  ──┬── Phase 1 (theme) ──┬── Phase 2 (nav) ── Phase 3 (intro modal)
                  │                     └── Phase 9 (landing)
                  └── Phase 4 (link framework) ──┬── Phase 5 (duckdb + DataSource)
                                                 │      ├── Phase 6 (table)
                                                 │      └── Phase 7 (editor)  [also needs 6]
                                                 └── Phase 8 (3d graph)
```

Phase 0 blocks everything. After it, **{1, 4, 9} can run in parallel**. Phase 5 must land before
6 and 7. Phase 7 needs Phase 6's table registration to link against.

---

## Phase 0 — Vite migration and dependency baseline

**Depends on:** nothing. **Blocks:** everything. **Do this alone, merge it, then fan out.**

### Goal
Replace react-scripts with Vite, fix the latent defects, and leave the app behaving exactly as it
does today.

### Steps

1. Remove `react-scripts` and the `@babel/plugin-proposal-private-property-in-object` workaround
   from `package.json`. Add `vite`, `@vitejs/plugin-react`, `lodash`, `@types/lodash`.
2. Scripts become:
   ```json
   "dev": "vite", "build": "tsc --noEmit && vite build", "preview": "vite preview"
   ```
3. Move `public/index.html` → `/index.html`. Replace `%PUBLIC_URL%/manifest.json` — either add a
   real `public/manifest.json` or drop the `<link>`. Add before `</body>`:
   `<script type="module" src="/src/main.tsx"></script>`.
4. Rename `src/index.tsx` → `src/main.tsx`; switch to
   `createRoot(document.getElementById('root')!).render(...)`.
5. `vite.config.ts`:
   ```ts
   import { defineConfig } from 'vite';
   import react from '@vitejs/plugin-react';
   export default defineConfig({
     plugins: [react()],
     // duckdb-wasm ships pre-bundled ESM workers; excluding it stops esbuild
     // from mangling the worker entry points during dep optimization.
     optimizeDeps: { exclude: ['@duckdb/duckdb-wasm'] },
     worker: { format: 'es' },
   });
   ```
6. `tsconfig.json` — replace the compilerOptions with a Vite-appropriate set:
   `"target": "ES2020"`, `"module": "ESNext"`, `"moduleResolution": "bundler"`,
   `"lib": ["ES2020", "DOM", "DOM.Iterable"]`, `"jsx": "react-jsx"`, `"isolatedModules": true`,
   `"skipLibCheck": true`, `"noEmit": true`, `"types": ["vite/client"]`, keep `"strictNullChecks": true`,
   `"allowSyntheticDefaultImports"`, `"esModuleInterop"`, `"forceConsistentCasingInFileNames"`.
   Drop `outDir`/`allowJs`. With `jsx: react-jsx` the `import React from 'react'` lines are
   optional — leave existing ones, they are harmless.
7. Delete `src/_index.ts` (library surface, superseded by the standalone-app decision).
8. Remove the dead `MdAirlineSeatIndividualSuite` import from `TextSearch.tsx`.
9. `.gitignore`: add `dist/`. The checked-in `build/` directory is stale CRA output — delete it.

### Gotchas
- `src/index.scss` and `src/index.css` imports move to `main.tsx` unchanged; `sass` is already a devDep.
- `dockview-react/dist/styles/dockview.css` import must be preserved.
- CRA allowed `process.env.*`; Vite uses `import.meta.env.VITE_*`. Grep for `process.env` before finishing.

### Acceptance
`yarn dev` serves the app; the TradingView widget can be added, configured, saved as a board and
reloaded. `yarn build` succeeds with no TS errors. No console errors on load.

---

## Phase 1 — Theme system: dark + light, default dark

**Depends on:** Phase 0.

### Goal
Restore a real light/dark toggle. Today `src/theme.ts` exports `forcedDarkColorModeManager`, which
hard-pins dark and swallows writes.

### Steps
1. Delete `forcedDarkColorModeManager`. Use
   `createLocalStorageManager('fastboard-color-mode')` and pass it to `ChakraProvider` in
   `src/FastBoard.tsx:21`. Keep `initialColorMode: 'dark'`, `useSystemColorMode: false`.
2. `useAppColors.ts` already has a complete light branch (lines 90–112) — verify it reads correctly
   against real UI rather than assuming; the light `info` palette differs structurally from dark
   (dark builds Chakra scale strings like `yellow.400`, light uses rgba literals). Make both
   branches return the same *kind* of value so consumers can't break; prefer rgba literals in both.
3. `src/components/ColorModeSwitcher.tsx` exists — re-enable it in `nav-header.tsx` (currently
   commented out at lines 230–234), or fold the control into the appearance settings from step 4.
4. Add an **Appearance** section to the nav drawer or a settings modal exposing: color mode
   (dark/light/system), and the accent color currently frozen in `mainConfig.mainInfoColor`
   (`useAppColors.ts:80`). Persist via `useKvStore('appearance')`.
5. `mainConfig` is currently a module-level mutable object — mutating it does not trigger a React
   re-render. Move accent color into React state (Chakra theme extension or the Phase 4 store) so
   changing it actually repaints.
6. `dockview-theme-dark` / `dockview-theme-light` is already switched off `colorMode` in
   `Main.tsx:254` — confirm the light dockview theme reads acceptably.
7. `src/index.scss` hard-codes dark scrollbar colors **outside** the `.fastboard-dark` block
   (the rules at the top level, lines ~17–35, and again at ~55–70). Scope them properly under
   `.fastboard-dark` / `.fastboard-light`.

### Acceptance
Toggling the mode repaints the whole app including nav, dockview chrome, modals and scrollbars,
with no unreadable contrast. The choice survives a reload. Fresh profile defaults to dark.

---

## Phase 2 — Nav: tool select dropdowns with integrated search

**Depends on:** Phase 0 (Phase 1 preferred, for theming).

### Goal
Replace the three `<TextSearch>` boxes in `nav-header.tsx` (lines 142, 184, 198) with proper
dropdown menus that each contain their own search field.

### Why
`TextSearch` is a free-text input with a popover that only appears once you type, plus a separate
ADD/LOAD button — you cannot browse what exists. A dropdown that opens to the full list and filters
as you type is the requested behaviour.

### Build `src/nav/ToolMenu.tsx`

```ts
export interface ToolMenuItem {
  value: string;
  label: string;
  description?: string;
  group?: string;      // optional section header
  disabled?: boolean;
}
export interface ToolMenuProps {
  label: string;                 // button text, e.g. "Add tool"
  items: ToolMenuItem[];
  onSelect: (value: string) => void;
  icon?: React.ReactElement;
  typ?: componentType;           // color token family
  emptyText?: string;
  hotkey?: string;               // e.g. "Digit1"
}
```

Implementation notes:
- Chakra `<Menu>` + `<MenuButton>` + `<MenuList>`, with a non-closing `<Input>` pinned at the top of
  the list. Chakra's `MenuItem` steals arrow keys — set `autoSelect={false}` on `<Menu>` and manage
  the highlighted index yourself, or use `closeOnSelect` carefully. Keep `<Input>` out of the
  `MenuItem` focus ring by rendering it in a plain `<Box>` and calling `e.stopPropagation()` on its
  `onKeyDown` for anything other than Escape/Enter/Arrow.
- Filter on `label` **and** `value`, case-insensitive, preserving the alphabetical sort that
  `TextSearch` did (`items.sort((a,b) => a.label.localeCompare(b.label))`).
- Enter selects the highlighted item; Escape closes; the optional `hotkey` opens the menu via the
  existing `useKey` hook (`src/hooks/useKey.ts`, matches `KeyboardEvent.code`).
- Show `description` as dimmed secondary text — `BaseWidgetDict.description` is currently never
  surfaced anywhere in the UI. This is where it belongs.
- Selecting an item calls `onSelect` immediately. No separate action button.

### Rewire `nav-header.tsx`
Three menus: **Boards** (from `listAllBoardKeys()`, `onSelect={loadBoard}`), **Add tool**
(from `allWidgets`, `onSelect={addWidget}`, disable items already at `maxNo` — the count check
currently lives in `Main.tsx:173` and only reports failure via a toast after the fact; surface it
in the menu instead), **Saved tools** (from `listSavedSettings()`, `onSelect={loadWidget}`).
Keep the Save / Save As / Reset icon buttons.

The `Grid templateColumns='repeat(20, 1fr)'` layout is brittle — replace with a flex row
(`<HStack>`) with the app name left, menus centered, drawer/github right.

### Then
Delete `src/components/TextSearch.tsx` and its export once nothing references it.

### Acceptance
Every tool is discoverable by opening a menu without typing. Typing filters live. Keyboard
navigation works. Widgets at `maxNo` are visibly unavailable rather than failing on click.

---

## Phase 3 — Intro modal

**Depends on:** Phase 2 (it explains the new nav).

### Goal
A first-run modal explaining how to use FastBoard.

### Steps
1. `src/intro/IntroModal.tsx` — Chakra `<Modal size="3xl">`, styled to match the existing modals
   (`SettingsModal.tsx` is the reference: `borderRadius={0}`, `borderWidth={1}` in `colors.fore`,
   `fontFamily="courier new"`, header with a bottom border).
2. Multi-step, "Back / Next / Get started" with a step indicator. Content:
   - **What this is** — a dashboard of independent widgets you arrange yourself.
   - **Adding tools** — the Add tool menu (Phase 2).
   - **Arranging** — dockview: drag tabs to split/dock, drag out to float, right-click a tab for
     Rename / Settings / Save As / Lock / Maximize / Pop out, and the pop-out button on each group
     header (`GroupHeaderActions.tsx`).
   - **Configuring** — right-click → Settings; Save As stores the configured widget for reuse from
     the Saved tools menu.
   - **Saving a board** — Save / Save As in the header; boards persist in browser localStorage
     (**say plainly that nothing is uploaded anywhere and clearing site data loses boards**).
   - **Linking widgets** — query a table from the code editor (Phase 4/6/7).
3. Gate on `useKvStore('prefs')` key `introSeen` (a version number, not a boolean, so the modal can
   be re-shown after a significant release). Include a "Don't show again" checkbox.
4. Add a persistent "?" / help icon in the nav header that reopens it on demand.

### Acceptance
Shows once on a fresh profile, never again after dismissal, always reachable from the help icon.
Renders correctly in both color modes.

---

## Phase 4 — Widget linking framework

**Depends on:** Phase 0. **Blocks:** Phases 5–8.

### Goal
Let widgets discover and talk to each other: "each widget has an id, widgets can use global hooks to
find widgets and filter by type."

### Replace Recoil with Zustand
`src/reducers/recoilStates.ts` currently holds `AllDatasetsState` and `AllWidgetStates`. Recoil is
unmaintained (last publish 2023-03). This phase rewrites the store anyway.

Create `src/store/widgetStore.ts`:

```ts
export interface WidgetRecord {
  wKey: string;            // panel id, `${type}-${timestamp}`
  type: string;            // BaseWidgetDict.type
  name: string;            // user-visible title (follows tab renames)
  settings: Record<string, any>;
}

// Per-widget public surface other widgets may consume. A widget publishes
// this; consumers read it. Keep it serializable-ish — functions are allowed
// but are NOT persisted with the board.
export interface WidgetExports {
  [key: string]: unknown;
}

interface WidgetStore {
  widgets: Record<string, WidgetRecord>;
  states: Record<string, WidgetState>;      // private per-widget state (persisted)
  exports: Record<string, WidgetExports>;   // public surface (not persisted)

  register:   (w: WidgetRecord) => void;
  unregister: (wKey: string) => void;
  rename:     (wKey: string, name: string) => void;
  setSettings:(wKey: string, settings: Record<string, any>) => void;
  setState:   (wKey: string, patch: Partial<WidgetState>) => void;
  publish:    (wKey: string, exports: WidgetExports) => void;
}
```

Public hooks (`src/store/hooks.ts`) — this is the API the brief asks for:

```ts
useWidget(wKey): WidgetRecord | undefined
useWidgetsByType(type: string): WidgetRecord[]      // e.g. the editor listing all tables
useAllWidgets(): WidgetRecord[]
useWidgetState<T>(wKey): [T, (patch: Partial<T>) => void]
useWidgetExports<T>(wKey): T | undefined            // consume another widget's surface
usePublishExports(wKey, exports, deps): void        // publish your own; cleans up on unmount
```

### Wiring
- `Main.tsx` `addWidget` calls `register`; `removeWidgetBookkeeping` calls `unregister`; the Rename
  context-menu action calls `rename`. All three currently mutate local `useState` + Recoil — move
  them onto the store, keeping `widgets` derivable for board save/load.
- `WidgetPanel.tsx` `saveSettings` calls `setSettings` in addition to updating panel params.
- Board save/load (`nav-header.tsx` `saveBoard`, `Main.tsx` `loadBoard`) serializes
  `{ widgets, states }` only — **never `exports`** (may contain functions/handles).
- Delete `src/reducers/`, remove `RecoilRoot` from `FastBoard.tsx`, drop `recoil` from deps.

### Design notes
- Subscribe with selectors (`useStore(s => s.widgets[wKey])`) so one widget's update does not
  re-render every panel. Use `useShallow` for the array-returning hooks.
- `useWidgetsByType` must return a referentially stable array for unchanged input — derive with
  `useShallow` or memoize, otherwise consumers loop.
- Handle the dangling-reference case: widget A links to widget B by `wKey`; B is closed. Consumers
  must render a clear "linked widget no longer exists" state, not crash.

### Acceptance
Two widgets of the same type can be added; a third widget can enumerate them by type, pick one and
read its published exports live. Closing a linked widget degrades gracefully. Board save/load still
round-trips. No Recoil left in the tree.

---

## Phase 5 — DuckDB runtime and the DataSource contract

**Depends on:** Phase 4. **Blocks:** Phases 6, 7.

### Goal
One shared in-browser duckdb-wasm instance, plus the pluggable `DataSource` interface that the
expression builder and the grid are written against.

### 5a. DuckDB runtime — `src/data/duckdb/runtime.ts`

Lazy singleton, instantiated on first use, never at module load.

```ts
import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_mvp_wasm  from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker       from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_eh_wasm   from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker        from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

const BUNDLES: duckdb.DuckDBBundles = {
  mvp: { mainModule: duckdb_mvp_wasm, mainWorker: mvp_worker },
  eh:  { mainModule: duckdb_eh_wasm,  mainWorker: eh_worker  },
};

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;

export function getDuckDb(): Promise<duckdb.AsyncDuckDB> {
  if (!dbPromise) dbPromise = (async () => {
    const bundle = await duckdb.selectBundle(BUNDLES);
    const worker = new Worker(bundle.mainWorker!, { type: 'module' });
    const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    return db;
  })();
  return dbPromise;
}
```

**Verified facts** (checked against `@duckdb/duckdb-wasm@1.32.0`):
- `dist/` contains exactly `duckdb-mvp.wasm`, `duckdb-eh.wasm`, `duckdb-coi.wasm` and the matching
  `duckdb-browser-{mvp,eh,coi}.worker.js`.
- Bindings expose `registerFileBuffer`, `registerFileText`, `registerFileURL`, `insertCSVFromPath`,
  `insertJSONFromPath`, `insertArrowFromIPCStream`, `getTableNames`, `dropFile`, `connect`.
- It depends on `apache-arrow@^17`. **Install `apache-arrow@^17`, not 21** — a second arrow major in
  the tree produces `instanceof` failures when decoding result vectors.
- Skip the `coi` bundle. It needs cross-origin isolation (COOP `same-origin` + COEP
  `require-corp`), which breaks the TradingView iframe widget. `selectBundle` will pick `eh` or
  `mvp`; that is fine.

### 5b. Ingestion — `src/data/duckdb/ingest.ts`

```ts
registerCsv(file: File, tableName: string): Promise<TableSchema>
registerJson(file: File, tableName: string): Promise<TableSchema>
registerParquet(file: File, tableName: string): Promise<TableSchema>
registerUrl(url: string, format: Format, tableName: string): Promise<TableSchema>
```

Pattern: `await db.registerFileBuffer(name, new Uint8Array(await file.arrayBuffer()))`, then
`CREATE TABLE <t> AS SELECT * FROM read_csv_auto('<name>')` /
`read_json_auto('<name>')` / `read_parquet('<name>')`.
Sanitize `tableName` to `[A-Za-z_][A-Za-z0-9_]*` and quote identifiers — user-supplied names reach SQL.
Derive the schema with `DESCRIBE <table>` and map duckdb types onto `FieldType` below.

### 5c. Contracts — `src/data/types.ts`

This file is the deliverable other phases are written against. Get it right; it should not churn.

```ts
export type FieldType = 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'timestamp' | 'categorical';

export interface FieldDef {
  name: string;
  label?: string;
  type: FieldType;
  nullable?: boolean;
  /** Required when type === 'categorical'. Drives the value dropdown in the expression builder. */
  categories?: Array<{ label: string; value: string | number }>;
}

export interface TableSchema { name: string; fields: FieldDef[]; rowCount?: number }

/* ---- Expression AST: what the builder produces and a source consumes ---- */
export type ComparisonOp =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'notContains'
  | 'startsWith' | 'notStartsWith'
  | 'endsWith' | 'notEndsWith'
  | 'like' | 'notLike'
  | 'in' | 'notIn'
  | 'between' | 'notBetween'
  | 'isNull' | 'isNotNull';

export interface Condition {
  kind: 'condition';
  id: string;
  field: string;
  op: ComparisonOp;
  /** scalar for most ops; array for in/notIn; [lo,hi] for between; absent for isNull/isNotNull. */
  value?: string | number | boolean | Array<string | number> | null;
}
export interface Group {
  kind: 'group';
  id: string;
  combinator: 'and' | 'or';
  negated?: boolean;          // NOT (...)
  children: Expression[];     // nesting is unbounded
}
export type Expression = Condition | Group;

export interface SortSpec { field: string; direction: 'asc' | 'desc' }
export interface QueryRequest {
  filter?: Expression;
  sort?: SortSpec[];
  offset: number;
  limit: number;
  select?: string[];
}
export interface QueryResult { rows: Record<string, unknown>[]; totalRows: number }

/** Implement this to plug any backend into the table widget. */
export interface DataSource {
  readonly id: string;
  readonly label: string;
  getSchema(): Promise<TableSchema>;
  /** Lazily resolve categories for a categorical field (SELECT DISTINCT under the hood). */
  getCategories?(field: string): Promise<Array<{ label: string; value: string | number }>>;
  query(req: QueryRequest): Promise<QueryResult>;
  /** Optional: expose the source under a name the SQL editor can query. */
  sqlName?: string;
}
```

Also ship `src/data/expression.ts`:
- `toSql(expr: Expression, fields: FieldDef[]): { sql: string; params: unknown[] }` —
  **parameterized; never interpolate values.** Map: `contains` → `field LIKE '%'||?||'%'`,
  `like` → `field LIKE ?` (user supplies `%`), `in` → `field IN (?,?,…)`,
  `between` → `field BETWEEN ? AND ?`, negatives wrap in `NOT (...)`.
  Field names are identifiers, not parameters — validate each against the schema's field list and
  quote with `"` before embedding. Reject unknown fields.
- `toHumanString(expr, fields): string` — for a read-only filter summary in the grid header.
- `validate(expr, fields): string[]` — errors to show before the user can apply.
- `emptyGroup()`, `emptyCondition()` factories.

**`DuckDbDataSource`** (`src/data/duckdb/DuckDbDataSource.ts`) implements `DataSource` over a
registered table: `getSchema` from `DESCRIBE`, `query` composing
`SELECT … WHERE <toSql> ORDER BY … LIMIT ? OFFSET ?` plus a `COUNT(*)` for `totalRows`,
`getCategories` via `SELECT DISTINCT <field> … LIMIT 1000`.

### Acceptance
Unit-test `toSql` over every operator and at least one three-level nested group with mixed
and/or and a negation. A dev-only scratch page loads a CSV and a Parquet file and returns correct
filtered, sorted, paginated rows. Bundle check: duckdb is not in the initial chunk.

---

## Phase 6 — Data table widget (ag-grid) + expression builder

**Depends on:** Phase 5.

### 6a. Widget — `src/widgets/table/TableWidget.tsx`

ag-grid **v36** is a significant departure from older versions — both of the following are verified
against `ag-grid-community@36.2.0`:

- **Modules must be registered** once at module scope:
  ```ts
  import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
  ModuleRegistry.registerModules([AllCommunityModule]);
  ```
  (Narrower alternative: `ClientSideRowModelModule`, `PaginationModule`.)
- **Theming is JS, not CSS.** Do **not** import `ag-grid-community/styles/*.css`. Use the Theming
  API and drive it off `useAppColors()`:
  ```ts
  import { themeQuartz, colorSchemeDark } from 'ag-grid-community';
  const theme = colorMode === 'dark'
    ? themeQuartz.withPart(colorSchemeDark).withParams({ backgroundColor: colors.bg, foregroundColor: colors.fore, accentColor: colors.info })
    : themeQuartz.withParams({ ... });
  ```
  Memoize the theme object — rebuilding it every render remounts the grid.

Behaviour:
- Client-side row model. `pagination`, `paginationPageSize`, `paginationPageSizeSelector: [25, 50, 100, 250, 500]`.
- Column defs generated from `TableSchema.fields`; map `FieldType` → `cellDataType`
  (`'text' | 'number' | 'boolean' | 'date'`).
- A toolbar above the grid: data-source picker, a **Filter** button opening the expression builder,
  a one-line human-readable summary of the active filter with a clear (×), and row count.
- Fetch through `DataSource.query`. With the community client-side row model you hold one page in
  memory at a time — pass `rowData` for the current page and render your own page controls, or load
  the full result set when `totalRows` is small (< 50k). Pick one and be consistent; document it.
- `stopPropagation` on the container (`onMouseDown`, `onTouchStart`) or dockview hijacks drags.
- Grid needs an explicit height — wrap in a `Box h="100%"` flex column; the grid takes `flex={1}`.

Settings (`WidgetSetting[]`): default page size, source table name, whether to show the filter bar.
File upload cannot be a `WidgetSetting` — put an upload dropzone in the widget body when no source
is bound yet.

**Publish for Phase 7** via `usePublishExports(wKey, ...)`:
```ts
interface TableWidgetExports {
  tableName: string;            // duckdb table name, queryable from the editor
  schema: TableSchema;
  applyFilter: (e: Expression) => void;
  setRows: (rows: Record<string, unknown>[], schema: TableSchema) => void;  // editor pushes results here
}
```

### 6b. Expression builder — `src/widgets/table/ExpressionBuilder.tsx`

A modal editing an `Expression` tree. This is the most intricate UI in the plan; budget for it.

Requirements from the brief, restated concretely:
- Modal, styled like `SettingsModal`.
- Renders a tree. A **group** row shows an and/or toggle, an optional NOT, "+ Condition",
  "+ Group" and a remove button, with children indented and a visible nesting guide (left border in
  `colors.foreQuarter`). Nesting is unbounded; the root is always a group.
- A **condition** row is progressive: field dropdown first; once a field is chosen, the operator
  dropdown appears, populated with only the operators valid for that field's `FieldType`; once an
  operator is chosen, the value input appears, its widget chosen by type:

  | `FieldType` | value widget |
  |---|---|
  | `string` | text input |
  | `number` / `integer` | number input |
  | `boolean` | true/false select |
  | `date` / `timestamp` | date input |
  | `categorical` | **select** (multi-select for `in`/`notIn`), options from `FieldDef.categories` or `getCategories(field)` |

  `between`/`notBetween` render two inputs. `in`/`notIn` render a multi-value control.
  `isNull`/`isNotNull` render none.
- Changing the field resets op and value if the old op is not valid for the new type.
- Operator sets by type: strings get the full text family (`contains`, `like`, `startsWith`, …);
  numbers/dates get comparisons + `between`; booleans get `eq`/`neq`; categoricals get
  `eq`/`neq`/`in`/`notIn`. All types get `isNull`/`isNotNull`.
- Live preview of the generated SQL (or `toHumanString`) at the bottom.
- Footer: Cancel, Clear all, Apply. Apply is disabled while `validate()` returns errors; show them inline.
- Every node carries a stable `id` (`crypto.randomUUID()`) — use it as the React key. Index keys
  will corrupt the tree on add/remove.

Keep this component **generic over `FieldDef[]` and `Expression`** with no duckdb import. It must
work unchanged against a future remote `DataSource`.

### Acceptance
Load a CSV with a mix of text/number/date/low-cardinality columns. Build
`(a contains "x" OR b in [1,2]) AND NOT (c between 5 and 10)` through the UI, apply it, and get
correct rows. Reopening the modal restores the exact tree. Page size changes work. Filter and page
size survive a board save/reload. Grid matches the app theme in both color modes.

---

## Phase 7 — Integrated code editor widget

**Depends on:** Phase 5, and Phase 6 for something to link to.

### Goal
Monaco editor widget with syntax highlighting, able to run duckdb SQL and target a table widget.

### 7a. Monaco under Vite — `src/widgets/editor/monaco-setup.ts`

`@monaco-editor/react` loads Monaco from a CDN by default. Self-host instead:

```ts
import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker   from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker     from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

self.MonacoEnvironment = {
  getWorker(_: string, label: string) {
    if (label === 'json') return new jsonWorker();
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  },
};
loader.config({ monaco });
```

Import this module once, lazily, from the editor widget. `monaco-editor` is large (~3–5 MB) — it
**must** be behind `React.lazy`. Verify with `vite build` that it lands in its own chunk.

### 7b. Widget — `src/widgets/editor/EditorWidget.tsx`

- `<Editor>` from `@monaco-editor/react`, `height="100%"`, `theme` switched off `colorMode`
  (`vs-dark` / `light`, or register a custom theme built from `useAppColors()`).
- Language via a setting: `sql`, `javascript`, `typescript`, `python`, `json`, `yaml`, `markdown`,
  `shell`. Monaco's basic-languages bundle covers all of these with highlighting for free; only
  json/ts get full language services.
- **SQL mode** adds a run bar: a target picker listing table widgets via
  `useWidgetsByType('table')` (Phase 4), Run (Ctrl/Cmd+Enter), and a result strip showing row
  count / elapsed / errors.
- Run: `const conn = await db.connect(); const res = await conn.query(sql); await conn.close();`
  Convert the Arrow table with `res.toArray().map(r => r.toJSON())`, derive a `TableSchema` from
  `res.schema.fields`, then call the target's `setRows(rows, schema)` from its published exports.
  Guard with try/catch and surface the duckdb error text verbatim — it is genuinely useful.
- Offer completions for the table names and columns published by live table widgets
  (`monaco.languages.registerCompletionItemProvider('sql', …)`). Dispose the provider on unmount,
  or repeated widget mounts stack duplicate suggestions.
- Persist editor content in widget state (Phase 4) so it survives board save/reload. Debounce writes
  (~500 ms); do not write on every keystroke.
- `stopPropagation` on the container. Call `editor.layout()` on dockview panel resize —
  subscribe to `props.api.onDidDimensionsChange`, Monaco does not self-size inside a flex panel.

### Acceptance
Type `SELECT * FROM my_table WHERE x > 5`, hit Ctrl+Enter, see the results appear in the linked
table widget. A syntax error shows the duckdb message, not a blank panel. Switching language
re-highlights. Content survives reload. Closing the linked table shows a clear message rather than
throwing. Monaco is in its own lazy chunk.

---

## Phase 8 — 3D graph explorer

**Depends on:** Phase 4. **Status: implemented** (`src/widgets/graph/`; notes at the end of this phase).

### Goal
Browse a data catalog as entities and relationships in 3D.

### Library
`react-force-graph-3d@^1.29.1` — a React wrapper over `3d-force-graph`, which bundles its own
three.js internally. It is independent of the Phase 9 R3F stack; **do not try to share a three.js
instance between them** or render it inside an R3F canvas.

### Widget — `src/widgets/graph/GraphWidget.tsx`

```ts
export interface CatalogNode {
  id: string;
  label: string;
  kind: 'database' | 'schema' | 'table' | 'column' | 'dataset' | string;
  meta?: Record<string, unknown>;
}
export interface CatalogLink { source: string; target: string; relation: string }
export interface CatalogGraph { nodes: CatalogNode[]; links: CatalogLink[] }

/** Implement to plug a catalog in. Mirrors the DataSource pattern from Phase 5. */
export interface CatalogSource {
  readonly id: string;
  readonly label: string;
  getGraph(): Promise<CatalogGraph>;
  /** Optional lazy expansion when a node is clicked. */
  expand?(nodeId: string): Promise<CatalogGraph>;
}
```

Ship `DuckDbCatalogSource` as the reference implementation: build the graph from
`duckdb_databases()` / `duckdb_schemas()` / `duckdb_tables()` / `duckdb_columns()`, linking
database → schema → table → column. It gives a real, working catalog with zero backend.

Behaviour:
- Color nodes by `kind` using `useAppColors()` semantic tokens; size by degree.
- Hover shows a label; click selects and opens a side detail panel with `meta`; double-click calls
  `expand` if present; right-click or a button focuses the camera on the node.
- Background from `colors.bg` so it matches the active theme.
- Search box filtering/highlighting nodes by label.
- Publish `{ selectedNodeId, selectedNode }` as widget exports so a table widget could follow the
  selection later.
- Lazy-load the whole widget. Call `forceGraph.width/height` on panel resize
  (`props.api.onDidDimensionsChange`) — the library does not auto-size.
- Guard the node count (warn above ~5000 nodes) and let users cap depth; force layout in 3D gets
  slow fast.

### Acceptance
Loading a couple of CSVs into duckdb produces a navigable graph of database/schema/table/column.
Rotate, zoom, hover, click-to-detail and search all work. Runs at a usable frame rate on a
mid-range laptop. Theme-aware background.

### As built
- `catalog.ts` (contracts), `DuckDbCatalogSource.ts` (reference source), `graphModel.ts` (pure
  depth/degree/search/merge logic), `GraphWidget.tsx`, `config.ts`. Registered as widget type `graph`.
- `duckdb_schemas()` flags the user's own `main` schema as `internal`, so the schema query keeps schemas
  by *database* not being internal instead. The first draft used `WHERE NOT internal` and produced an
  empty graph; `catalogQueries.test.ts` runs the queries on real duckdb-wasm to guard it.
- `3d-force-graph` needs `three >=0.179`, so the app moved from 0.169 to 0.186 (the 0.169 pin only existed
  for R3F v8, since dropped). This keeps a single three.js in the tree, which the node labels rely on:
  `three-spritetext` sprites must come from the same three as the renderer that draws them.
- Nodes are labelled with sprites; large graphs label only what stays readable (`shouldLabel`), and the
  toolbar has a Labels toggle. Columns are coloured by data-type family (`typeGroup`), with the semantic
  hues reserved for types and the accent/neutral tones for database/schema/table.
- The graph reloads when a table widget binds a table, and has a Refresh button for tables created from SQL.
  `CatalogSource.expand` is supported by the widget but the duckdb source does not implement it (the whole
  catalog is loaded up front; depth is capped with the toolbar selector instead).
- Only the duckdb catalog is shown; qpl-engine tables are not listed.

---

## Phase 9 — Landing page with three.js background

**Depends on:** Phase 0 (Phase 1 for theming). **Status: implemented** (`src/landing/`, `src/App.tsx`;
notes at the end of this phase).

### Goal
A front page for the tool with a stylish 3D background: cartoonish flying shapes on a dark
background that move out of the way of the cursor.

### Stack constraint — read this first
`@react-three/fiber@9` and `@react-three/drei@10` **require React >=19**. We are on React 18.2
(locked, Section 2). Use:

```
three ^0.169.0  +  @react-three/fiber ^8.18.0  (peer: react >=18 <19)  +  @react-three/drei ^9.122.0
```

Do not let a `yarn upgrade` pull R3F v9 — it installs cleanly and then fails at runtime on React 18
internals. Consider pinning exact versions. Also note `three@0.186` (current latest) is well ahead
of what drei 9 was tested against; stay on the ~0.169 line and smoke-test before going further.

### Routing
Upgrade `wouter` 2.12 → `^3.11.0` (the `<Route>`/`useLocation` API changed between majors — check
the migration notes). `src/App.tsx`:

```
"/"       → <Landing>
"/board"  → <FastBoard>     (lazy)
```

Keep `FastBoard` lazy so the landing page does not pull dockview, duckdb or Monaco.

### `src/landing/Scene.tsx`

- `<Canvas dpr={[1, 2]} camera={{ position: [0, 0, 12], fov: 60 }}>`, `flat` + `ACESFilmicToneMapping`
  off for the flat cartoon look.
- **Cartoon look:** `meshToonMaterial` with a 3–4 step gradient map (a tiny `DataTexture` with
  `magFilter = minFilter = THREE.NearestFilter`), one directional light plus low ambient, and
  drei's `<Outline>` or a back-face-hull outline pass for the ink edge. A flat-shaded
  `meshStandardMaterial` with `flatShading: true` and a small palette is a cheaper fallback.
- **Shapes:** 40–80 instances mixing icosahedron / torus / cone / box / dodecahedron. Use
  `<Instances>` from drei (one draw call per geometry type). Random scale, slow drift, per-instance
  rotation.
- **Cursor avoidance** — the part worth getting right:
  - Track the pointer in normalized device coords via R3F's `state.pointer`.
  - Each frame in `useFrame`, unproject the pointer onto the z-plane of each shape to get a world
    space cursor position. For each shape compute `d = shape.position - cursor`; if
    `|d| < RADIUS` (~3 world units), add a repulsion velocity along `normalize(d)` scaled by
    `(1 - |d|/RADIUS)²` so it eases in rather than snapping.
  - Integrate a velocity per instance with damping (`v *= 0.92`) and a weak spring back to the
    shape's home position, so the field settles after the cursor leaves. Do **not** set positions
    directly from the cursor — it looks mechanical and is what the brief is asking you to avoid.
  - Mutate instance matrices in `useFrame` and set `instancedMesh.instanceMatrix.needsUpdate = true`.
    **Never drive this with React state** — 60 setState calls per frame will lock the page.
- **Performance and respect:** honour `prefers-reduced-motion` (render a static frame or a CSS
  gradient instead); cap dpr; `frameloop="demand"` is not appropriate here (continuous animation)
  but do pause on `document.hidden`.
- **Fallback:** wrap in an error boundary; if WebGL is unavailable, show a CSS gradient background.
  The landing page must never be a blank screen.

### `src/landing/Landing.tsx`
Scene as a fixed full-viewport background (`position: fixed; inset: 0; z-index: 0`), content above
it (`z-index: 1`, `pointer-events: none` on the canvas wrapper so the content stays clickable —
the scene reads pointer position from a window-level listener, not from canvas events).
Content: product name, one-line description, a primary "Open dashboard" → `/board`, a secondary
"How it works" opening the Phase 3 intro modal, and a short feature strip (tables, SQL, catalog graph).

### Acceptance
Landing loads in well under a second with three.js in its own lazy chunk. Shapes visibly and
smoothly dodge the cursor and settle back. Smooth on a mid-range laptop. Reduced-motion and
no-WebGL paths both degrade gracefully. "Open dashboard" routes to a working board.

### As built - and one deviation from the stack above
- **Plain three.js, not R3F/drei.** With `@react-three/fiber` in the TypeScript program its ~180 added
  global JSX element names make Chakra's polymorphic `as` typing overflow (TS2590) on every component that
  spreads `as`-carrying props - `Input`, `MultiSelect`, `NumberInput`, `ColorModeSwitcher`... and which
  ones fail moves around as files change, so suppressing them is whack-a-mole. The scene is one loop over
  instanced meshes, so `shapeField.ts` drives three directly and `Scene.tsx` is a thin React shell.
  Everything else in this section holds: React 18, `three ^0.186`, toon shading with a stepped gradient
  map, inverted-hull outlines (a scaled back-face copy, no postprocessing), one instanced mesh per shape
  kind, cursor repulsion with velocity + damping + a spring home, no React state per frame, pause on a
  hidden tab, still frame under `prefers-reduced-motion`, CSS gradient when WebGL is missing or the chunk
  fails. The pointer is read from a window listener.
- The shapes are finance/network motifs rather than the plan's generic polyhedra: scales of justice,
  terminals, Bitcoin coins (the raised B on both faces), candlesticks, bar charts, trend arrows and
  oil barrels (compound geometry merged per kind, so still one draw call each), coloured by meaning (Bitcoin
  orange, candles green/red, barrels red/blue, scales and terminals accent). Thin links join each
  shape to up to 3 near neighbours, like a live network.
- Shapes bounce off each other (`collide`, equal density, resolved in *screen* space so depth does not hide
  an overlap) and start from relaxed, non-overlapping rest positions (`relaxHomes`); they are scaled down
  when they would crowd the view (26% coverage cap), e.g. on a phone.
- `physics.ts` holds the motion as pure functions (unit tested); `shapeField.test.ts` runs the real scene
  code against a stubbed renderer and asserts on the actual instance matrices.
- Routing is wouter 3: `/` landing, `/board` lazy board, anything else redirects to `/`. Providers moved up
  to `Providers.tsx` so both routes share one theme. Leaving the board resets the widget store, since the
  dockview layout does not survive the route change. The board header's app name links home.
- A static host needs an SPA fallback so a direct hit on `/board` serves `index.html`.

---

## 4. Cross-cutting checklist

Before any phase is called done:

- [ ] `yarn build` clean (`tsc --noEmit` included).
- [ ] No new `any` on a cross-phase contract.
- [ ] Both color modes checked visually.
- [ ] New widgets: added to `src/widgets/registry.ts`, settings render in the generated modal,
      `maxNo` sensible, `description` written (it is shown in the Phase 2 menu).
- [ ] New widgets: `stopPropagation` wired, resize handled, board save/load round-trips.
- [ ] Heavy deps lazy-chunked — check `dist/assets` after a build, don't assume.
- [ ] Anything not verified is stated as unverified in the handover report.

## 5. Open items deliberately left out of scope

- No backend, no auth, no multi-user sharing. Boards live in one browser's localStorage and are
  lost if site data is cleared — the intro modal must say so plainly.
- localStorage has a ~5 MB ceiling. Boards are small, but ingested data is **not** persisted at all;
  a reload means re-uploading files. If persistence is wanted later, duckdb-wasm's OPFS support
  (`registerOPFSFileName`) is the path.
- ag-grid Community excludes grouping, pivot, master-detail and the server-side row model. If very
  large tables become a real requirement, that is the point to revisit the Enterprise decision.
- No test framework is currently configured. Phase 5's `toSql` really should have unit tests —
  add Vitest during that phase (it comes free with Vite) rather than deferring indefinitely.
