import React, { useState } from 'react';
import {
    useColorMode,
    Box,
} from '@chakra-ui/react';
import {
    DockviewReact,
    DockviewReadyEvent,
    DockviewApi,
    BuiltInContextMenuItem,
    ReactContextMenuItemConfig,
    GetTabContextMenuItemsParams,
    ContextMenuModule,
    registerModules,
} from 'dockview-react';
import useAppColors from '../hooks/useAppColors';
import WidgetPanel from './WidgetPanel';
import GroupHeaderActions from './GroupHeaderActions';
import { PanelContext, PanelActions } from './PanelContext';
import { WidgetPanelParams } from './types';

// nav
import NavHeader from '../nav/nav-header';
import NavMenu from '../nav/nav';

import {
    BaseWidgetDict,
    WidgetDict,
    WidgetComponentMapping,
    WidgetConfig
} from '../interfaces';
import useUserAlert from '../hooks/useUserAlert';
import useKvStore from '../hooks/useKvStore';
import { useWidgetStore, WidgetRecord } from '../store/widgetStore';
import { useShallow } from 'zustand/react/shallow';

interface DashboardContainerProps {
    appName: string;
    widgetConfig: BaseWidgetDict[];
    widgetComponentMapping: Record<string, React.FC<any>>;
}

// dockview's panel component map is keyed by an arbitrary component id, not
// by widget type - every widget uses the same "widget" renderer and
// distinguishes itself via panel params (see WidgetPanelParams). Tabs are
// left to dockview's own native tab (title + drag/dock/close) - right-click
// gives access to the rest (rename, settings, save as, lock, maximize, ...).
const dockviewComponents = { widget: WidgetPanel };

// Free, non-enterprise module: powers getTabContextMenuItems below.
// Registering is idempotent and only needs to happen once, at import time.
registerModules([ContextMenuModule]);

const DashboardContainer: React.FC<DashboardContainerProps> = ({
    appName, widgetConfig, widgetComponentMapping
}: DashboardContainerProps) => {
    const [ menuOpen, setMenuOpen ] = useState<boolean>(false);
    const [ dockviewApi, setDockviewApi ] = useState<DockviewApi>();
    // Widget registry lives in the zustand store (the widget-linking framework -
    // see src/store/widgetStore.ts) rather than local state, so it is the single
    // source of truth shared with other widgets/panels. `widgets` below is the
    // fuller WidgetDict[] shape (static config + current settings) derived from
    // it, kept for board save/load and maxNo checks - unchanged from before.
    const storeWidgets = useWidgetStore(useShallow((s) => s.widgets));
    const register = useWidgetStore((s) => s.register);
    const unregister = useWidgetStore((s) => s.unregister);
    const renameWidget = useWidgetStore((s) => s.rename);
    const setWidgetSettings = useWidgetStore((s) => s.setSettings);
    const loadWidgetsIntoStore = useWidgetStore((s) => s.loadWidgets);
    const resetWidgetStore = useWidgetStore((s) => s.resetAll);
    const widgets: WidgetDict[] = React.useMemo(() => Object.values(storeWidgets).map((w) => {
        const cfg = widgetConfig.find((c) => c.type === w.type);
        const typeNumber = Number(w.wKey.slice(w.type.length + 1)) || 0;
        return {
            ...(cfg as BaseWidgetDict),
            type: w.type,
            name: w.name,
            key: w.wKey,
            typeNumber,
            currentSettings: w.settings,
        } as WidgetDict;
    }), [storeWidgets, widgetConfig]);
    const [ currentBoardKey, setCurrentBoardKey] = useState<string>("");
    const { get: getSavedBoard } = useKvStore('allBoards');
    const [ colors ] = useAppColors();
    const { colorMode } = useColorMode();

    // populated by each WidgetPanel so the tab context menu (built outside
    // any one panel's React tree) can open that panel's Settings/Save As modals
    const panelActionsRef = React.useRef(new Map<string, PanelActions>());
    const registerPanelActions = React.useCallback((key: string, actions: PanelActions) => {
        panelActionsRef.current.set(key, actions);
    }, []);
    const unregisterPanelActions = React.useCallback((key: string) => {
        panelActionsRef.current.delete(key);
    }, []);

    const toggleMenuOpen = () => setMenuOpen(!menuOpen);
    const userAlert  = useUserAlert()

    const removeWidgetBookkeeping = (key: string) => {
        unregister(key);
    };

    const onReady = (event: DockviewReadyEvent) => {
        setDockviewApi(event.api);
        event.api.onDidRemovePanel(panel => removeWidgetBookkeeping(panel.id));
    };

    const getTabContextMenuItems = (
        ctxParams: GetTabContextMenuItemsParams
    ): (BuiltInContextMenuItem | ReactContextMenuItemConfig)[] => {
        const { panel, group } = ctxParams;
        const actions = panelActionsRef.current.get(panel.id);
        const items: (BuiltInContextMenuItem | ReactContextMenuItemConfig)[] = [
            {
                label: 'Rename',
                action: () => {
                    const nextName = window.prompt('Rename widget', panel.title || '');
                    if (nextName && nextName.trim()) {
                        panel.api.setTitle(nextName.trim());
                        renameWidget(panel.id, nextName.trim());
                    }
                },
            },
        ];
        if (actions) {
            items.push(
                { label: 'Settings', action: actions.openSettings },
                { label: 'Save As', action: actions.openSaveAs },
            );
        }
        items.push(
            'separator',
            { label: group.locked ? 'Unlock' : 'Lock', action: () => { group.locked = !group.locked; } },
            'separator',
            'maximize',
            'float',
            'popout',
            'separator',
            'close',
            'closeOthers',
            'closeAll',
        );
        return items;
    };

    const loadBoard = (boardKey: string) => {
        const boardObj = getSavedBoard(boardKey);
        if (!boardObj || !dockviewApi) {
            return;
        }
        dockviewApi.fromJSON(boardObj.layout);
        // Rebuild the store's registry from the persisted WidgetDict[] (backward
        // compatible with boards saved before this phase - that shape hasn't changed).
        const widgetsByKey: Record<string, WidgetRecord> = {};
        (boardObj.widgets || []).forEach((w) => {
            widgetsByKey[w.key] = {
                wKey: w.key,
                type: w.type,
                name: w.name,
                settings: w.currentSettings || {},
            };
        });
        loadWidgetsIntoStore(widgetsByKey, boardObj.widgetStates || {});
        setCurrentBoardKey(boardKey);
    }

    const resetBoard = () => {
        dockviewApi?.clear();
        resetWidgetStore();
    }

    const saveWidgetSettings = (key: string, settings: Record<string, any>) => {
        setWidgetSettings(key, settings);
    }

    const addWidget = (type: string, savedSettings?: Record<string, any>) => {
        if (!dockviewApi) {
            return;
        }
        const widgetDict = widgetConfig.find(widget => widget.type === type);
        if (!widgetDict) {
            userAlert(
                "Widget not found",
                "fail",
                `The widget ${type} was not found - are you sure this has been implemented?`
            );
            return;
        }
        const maxNo = widgetDict?.maxNo || 0;
        const existingWidgetCount = widgets.filter(widget => widget.type === type).length;
        if (existingWidgetCount >= maxNo) {
            userAlert(
                "Too many widgets",
                "fail",
                `You cannot have more than ${existingWidgetCount} ${widgetDict.name} widget(s)`
            );
            return;
        }

        const widgeTypeNumber = new Date().getTime();
        const key = `${type}-${widgeTypeNumber}`;

        const params: WidgetPanelParams = {
            widgetType: type,
            name: widgetDict.name,
            settingsConfig: widgetDict.settings,
            currentSettings: savedSettings,
        };
        dockviewApi.addPanel<WidgetPanelParams>({
            id: key,
            component: 'widget',
            title: widgetDict.name,
            params,
            initialWidth: widgetDict.defaultLayout.initialWidth,
            initialHeight: widgetDict.defaultLayout.initialHeight,
        });

        register({
            wKey: key,
            type,
            name: widgetDict.name,
            settings: savedSettings || {},
        });
    };

    const getCurrentLayout = () => dockviewApi?.toJSON();

    return (
        <Box w={"100%"} h={"100%"} className={`fastboard-${colorMode}`} display="flex" flexDirection="column">
            <title>{appName}</title>
            <Box
                className='rg-header-nav'
                style={{
                    borderRadius: 0,
                    borderColor: colors.foreQuarter,
                    borderWidth: 1,
                    zIndex: 4,
                    flexShrink: 0,
                    // Definite height: the header's children size themselves
                    // with h="100%", which resolves to `auto` against an
                    // auto-height parent and let the bar grow to ~116px.
                    height: 48,
                }}
            >
                <NavHeader
                    toggleNav={toggleMenuOpen}
                    menuOpen={menuOpen}
                    addWidget={addWidget}
                    allWidgets={widgetConfig as WidgetConfig}
                    appName={appName}
                    getCurrentLayout={getCurrentLayout}
                    resetLayout={resetBoard}
                    currentWidgets={widgets}
                    loadBoard={loadBoard}
                    currentBoardKey={currentBoardKey}
                />
                <NavMenu
                    navOpen={menuOpen}
                    navClose={toggleMenuOpen}
                    appName={appName}
                />
            </Box>
            <Box flex="1" minHeight={0} position="relative">
                <PanelContext.Provider value={{
                    widgetComponentMapping: widgetComponentMapping as WidgetComponentMapping,
                    saveWidgetSettings,
                    registerPanelActions,
                    unregisterPanelActions,
                }}>
                    <DockviewReact
                        className={`dockview-theme-${colorMode === 'dark' ? 'dark' : 'light'}`}
                        components={dockviewComponents}
                        leftHeaderActionsComponent={GroupHeaderActions}
                        getTabContextMenuItems={getTabContextMenuItems}
                        onReady={onReady}
                    />
                </PanelContext.Provider>
            </Box>
        </Box>
    );
};

export default DashboardContainer;
