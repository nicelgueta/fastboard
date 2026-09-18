import React from 'react';
import { Box, Center, Spinner } from '@chakra-ui/react';
import { IDockviewPanelProps } from 'dockview-react';
import useAppColors from '../hooks/useAppColors';
import { stopPropagation } from '../components/common';
import SettingsModal from '../modals/SettingsModal';
import SaveAsModal from '../modals/SaveAsModal';
import { usePanelContext } from './PanelContext';
import WidgetErrorBoundary from './WidgetErrorBoundary';
import { WidgetPanelParams, getDefaultSettings } from './types';

// The content rendered inside a widget's dockview panel: the widget itself,
// plus its Settings/Save As modals. The panel's title, drag/dock/close and
// right-click actions are all handled by dockview's own native tab - this
// component just registers handlers so that tab's context menu can reach in
// and open these modals (see Main.tsx's getTabContextMenuItems).
const WidgetPanel: React.FC<IDockviewPanelProps<WidgetPanelParams>> = (props) => {
    const { widgetType, name, settingsConfig } = props.params;
    const wKey = props.api.id;
    const { widgetComponentMapping, saveWidgetSettings, registerPanelActions, unregisterPanelActions } = usePanelContext();
    const [colors] = useAppColors();
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [settingsIsOpen, setSettingsOpen] = React.useState(false);
    const [saveAsIsOpen, setSaveAsOpen] = React.useState(false);
    const currentSettings = props.params.currentSettings || getDefaultSettings(settingsConfig);

    const saveSettings = (sts: Record<string, any>) => {
        props.containerApi.getPanel(wKey)?.update({ params: { ...props.params, currentSettings: sts } });
        saveWidgetSettings(wKey, sts);
        setSettingsOpen(false);
    };

    React.useEffect(() => {
        registerPanelActions(wKey, {
            openSettings: () => setSettingsOpen(true),
            openSaveAs: () => setSaveAsOpen(true),
        });
        return () => unregisterPanelActions(wKey);
    }, [wKey, registerPanelActions, unregisterPanelActions]);

    const WidgetElement = widgetComponentMapping[widgetType];

    return (
        <Box
            ref={containerRef}
            h="100%"
            w="100%"
            bgColor={colors.bg}
            overflow="auto"
            id={`${wKey}-div-container`}
            onMouseDown={stopPropagation}
            onTouchStart={stopPropagation}
        >
            <SettingsModal
                name={name}
                settingsIsOpen={settingsIsOpen}
                setSettingsOpen={setSettingsOpen}
                settingsConfig={settingsConfig}
                currentSettings={currentSettings}
                settingsCallback={saveSettings}
            />
            <SaveAsModal
                storeName={'saved_widgets'}
                objToSave={{ type: widgetType, settings: currentSettings }}
                isOpen={saveAsIsOpen}
                setIsOpen={setSaveAsOpen}
                helperText='Provide a name to save this widget settings'
            />
            {WidgetElement ? (
                // Heavy widgets (ag-grid, Monaco, duckdb) are React.lazy in
                // widgets/registry.ts, so every widget body needs a boundary.
                <WidgetErrorBoundary name={name}>
                <React.Suspense fallback={<Center h="100%" w="100%"><Spinner color={colors.info} /></Center>}>
                <WidgetElement
                    wKey={wKey}
                    isStatic={!!props.api.group.locked}
                    containerRef={containerRef}
                    settingsIsOpen={settingsIsOpen}
                    {...currentSettings}
                />
                </React.Suspense>
                </WidgetErrorBoundary>
            ) : null}
        </Box>
    );
};

export default WidgetPanel;
