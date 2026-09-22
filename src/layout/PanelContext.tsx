import React from 'react';
import { WidgetComponentMapping, WidgetConfig } from '../interfaces';

export interface PanelActions {
    openSettings: () => void;
    openSaveAs: () => void;
    openHelp: () => void;
}

// Shared app-level data that dockview's panel/tab components need but can't
// receive as ordinary props (dockview only gives them `params`/`api`/`containerApi`).
export interface PanelContextValue {
    widgetComponentMapping: WidgetComponentMapping;
    // Fallback for a panel's Help modal when its own params lack toolName/description
    // - a board saved before those fields existed. See WidgetPanel.tsx.
    widgetConfig: WidgetConfig;
    saveWidgetSettings: (key: string, settings: Record<string, any>) => void;
    // Lets the native tab context menu (built at the DockviewReact level,
    // outside any one panel's React tree) reach into a specific widget panel
    // to open its Settings/Save As modals.
    registerPanelActions: (key: string, actions: PanelActions) => void;
    unregisterPanelActions: (key: string) => void;
}

export const PanelContext = React.createContext<PanelContextValue>({
    widgetComponentMapping: {},
    widgetConfig: [],
    saveWidgetSettings: () => {},
    registerPanelActions: () => {},
    unregisterPanelActions: () => {},
});

export const usePanelContext = () => React.useContext(PanelContext);
