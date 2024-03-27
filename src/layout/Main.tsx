import React, { useState } from 'react';
import {
    useColorMode,
    useMediaQuery,
    Box,
} from '@chakra-ui/react';
import GridLayout from 'react-grid-layout';
import useAppColors from '../hooks/useAppColors';
import WidgetContainer from './WidgetContainer';

// nav
import NavHeader from '../nav/nav-header';
import NavMenu from '../nav/nav';

import {
    BaseWidgetDict,
    WidgetDict,
    Layout,
    Board,
    WidgetState
} from '../interfaces';
import useUserAlert from '../hooks/useUserAlert';
import useKvStore from '../hooks/useKvStore';
import { AllWidgetStates } from '../reducers/recoilStates';
import { useRecoilState } from 'recoil';

interface DashboardContainerProps {
    appName: string;
    widgetConfig: BaseWidgetDict[];
    widgetComponentMapping: Record<string, React.FC<any>>;
}

const DashboardContainer: React.FC<DashboardContainerProps> = ({
    appName, widgetConfig, widgetComponentMapping
}: DashboardContainerProps) => {
    const [ isLargerThan1280 ] = useMediaQuery('(min-width: 1280px)');
    const [ menuOpen, setMenuOpen ] = useState<boolean>(false);
    const [ widgets, setWidgets ] = useState<WidgetDict[]>([]);
    const [ layout, setLayout ] = useState<Layout[]>([
        { i: "rg-header", x: 0, y: 0, w: 48, h: 2, static: true }
    ]);
    const [ allWidgetStates, setWidgetStates ] = useRecoilState(AllWidgetStates);
    const [ currentBoardKey, setCurrentBoardKey] = useState<string>("");
    const { get: getSavedBoard } = useKvStore('allBoards');
    const [ colors ] = useAppColors();
    const { colorMode } = useColorMode();

    
    const toggleMenuOpen = () => setMenuOpen(!menuOpen);
    const userAlert  = useUserAlert()
    
    const loadBoard = (boardKey: string) => {
        const boardObj: Board = getSavedBoard(boardKey);
        if (!boardObj) {
            return;
        }
        const layout = boardObj.layout;
        const widgets = boardObj.widgets;
        const widgetStates = boardObj.widgetStates;
        setLayout(layout);
        setWidgets(widgets);
        setCurrentBoardKey(boardKey);
        setWidgetStates(widgetStates);
    }

    const resetBoard = () => {
        setLayout([
            { i: "rg-header", x: 0, y: 0, w: 96, h: 2, static: true}
        ]);
        setWidgets([]);
    }

    const removeWidget = (key: string) => {
        const newWidgets = widgets.filter(widget => widget.key !== key);
        setWidgets(newWidgets);

        const newLayout = layout.filter(item => item.i !== key);
        setLayout(newLayout);

        const newWidgetStates = { ...allWidgetStates };
        delete newWidgetStates[key];
        setWidgetStates(newWidgetStates);
    };

    const saveWidgetSettings = (key: string, settings: Record<string, any>) => {
        const newWidgets = widgets.map(widget => {
            if (widget.key === key) {
                return { ...widget, currentSettings: settings };
            }
            return widget;
        });
        setWidgets(newWidgets);
    }

    const addWidget = (type: string, savedSettings?: Record<string, any>) => {
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

        if (widgetDict) {
            const widgeTypeNumber = new Date().getTime();
            const key = `${type}-${widgeTypeNumber}`;
            const newWidgeDict: WidgetDict = { ...widgetDict, typeNumber: widgeTypeNumber, key: key };

            const newLayout: Layout = { ...newWidgeDict.defaultLayout, i: key };
            if (savedSettings) {
                newWidgeDict.currentSettings = savedSettings;
            }
            setLayout([...layout, newLayout]);
            setWidgets([...widgets, newWidgeDict]);
            setWidgetStates({
                ...allWidgetStates,
                [key]: {} as WidgetState
            });
        }
    };


    const toggleStatic = (key: string) => {
        const newLayouts = layout.map(item =>
            item.i === key ? { ...item, static: !item.static } : item
        );
        setLayout(newLayouts);
    };

    const getLayout = (key: string) => {
        return layout.find(item => item.i === key);
    };

    return (
        <Box w={"100%"} h={"100%"} className={`fastboard-${colorMode}`}>
            <title>{appName}</title>
            <GridLayout
                className="layout"
                layout={layout}
                height={Math.min(1080, window.screen.availHeight)}
                cols={isLargerThan1280 ? 96 : 1}
                rowHeight={20}
                width={Math.min(1920, window.screen.availWidth)}
                margin={[0, 0]}
                preventCollision
                compactType={null}
                resizeHandles={['s', 'e', 'se', 'sw', 'nw', 'w', 'n']}
                onLayoutChange={setLayout}
            >
                <div
                    key="rg-header"
                    className='rg-header-nav'
                    style={{
                        borderRadius: 0,
                        justifyContent: "center",
                        borderColor: colors.foreQuarter,
                        borderWidth: 1,
                        zIndex: 4,
                    }}
                >
                    <NavHeader
                        toggleNav={toggleMenuOpen}
                        menuOpen={menuOpen}
                        addWidget={addWidget}
                        allWidgets={widgetConfig}
                        appName={appName}
                        currentLayout={layout}
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
                </div>
                {widgets.map((widgetDict, i) => (
                    <div
                        key={widgetDict.key}
                        style={{
                            borderRadius: 0,
                            backgroundColor: colors.bg,
                            justifyContent: "center",
                            height: "100%",
                            width: "100%",
                            borderColor: colors.bg,
                        }}
                    >
                        <WidgetContainer
                            name={widgetDict.name}
                            wKey={widgetDict.key}
                            widgetType={widgetDict.type}
                            settingsConfig={widgetDict.settings}
                            isStatic={getLayout(widgetDict.key)?.static || false}
                            WidgetElement={widgetComponentMapping[widgetDict.type]}
                            removeWidget={removeWidget}
                            toggleStatic={toggleStatic}
                            saveWidgetSettings={saveWidgetSettings}
                            currentSettings={widgetDict.currentSettings}
                        />
                    </div>
                ))}
            </GridLayout>
        </Box>
    );
};

export default DashboardContainer;
