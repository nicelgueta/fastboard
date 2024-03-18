import React, { useState } from 'react';
import {
    useColorMode,
    useMediaQuery,
    IconButton,
    ButtonGroup,
    HStack,
    VStack,
    Box,
    Text,
} from '@chakra-ui/react';
import { stopPropagation } from '../hooks/stoppropagation';
import { Icon, Tooltip } from '@chakra-ui/react';
import { AiFillEye, AiFillPushpin } from 'react-icons/ai';
import GridLayout from 'react-grid-layout';
import useAppColors from '../hooks/colors';
import WidgetContainer from './WidgetContainer';

import { 
    ALL_WIDGETS, 
    widgetObjReference,
} from '../widgets';

// nav
import NavHeader from '../nav/nav-header';
import NavMenu from '../nav/nav';

import {
    WidgetDict,
    Layout,
    Board
} from '../interfaces';
import useCustomToast from '../hooks/useCustomToast';

interface DashboardContainerProps {
    appName: string;
}

const DashboardContainer: React.FC<DashboardContainerProps> = ({
    appName,
}: DashboardContainerProps) => {
    const [isLargerThan1280] = useMediaQuery('(min-width: 1280px)');
    const [menuOpen, setMenuOpen] = useState<boolean>(false);
    const toggleMenuOpen = () => setMenuOpen(!menuOpen);
    const [widgets, setWidgets] = useState<WidgetDict[]>([]);
    const [layout, setLayout] = useState<Layout[]>([
        { i: "rg-header", x: 0, y: 0, w: 48, h: 2, static: true }
    ]);

    React.useEffect(() => {
        const savedBoardKey = localStorage.getItem('currentBoard');
        if (!savedBoardKey) {
            return;
        }
        loadBoard(savedBoardKey);
    }, []);

    const colors = useAppColors();
    const { colorMode } = useColorMode();

    const toast  = useCustomToast()
    
    const loadBoard = (boardKey: string) => {
        const allBoards = localStorage.getItem('allBoards');
        if (!allBoards) {
            return;
        }
        const boardObj: Board = JSON.parse(allBoards)[boardKey];
        const layout = boardObj.layout;
        const widgets = boardObj.widgets;
        setLayout(layout);
        setWidgets(widgets);
    }

    const removeWidget = (key: string) => {
        const newWidgets = widgets.filter(widget => widget.key !== key);
        setWidgets(newWidgets);

        const newLayout = layout.filter(item => item.i !== key);
        setLayout(newLayout);
    };
    console.log(widgets)
    const saveWidgetSettings = (key: string, settings: Record<string, any>) => {
        const newWidgets = widgets.map(widget => {
            if (widget.key === key) {
                return { ...widget, currentSettings: settings };
            }
            return widget;
        });
        setWidgets(newWidgets);
    }

    const addWidget = (type: string) => {
        const widgetDict = ALL_WIDGETS.find(widget => widget.type === type);
        if (!widgetDict) {
            toast(
                "Widget not found",
                "fail",
                `The widget ${type} was not found - are you sure this has been implemented?`
            );
            return;
        }
        const maxNo = widgetDict?.maxNo || 0;
        const existingWidgetCount = widgets.filter(widget => widget.type === type).length;
        if (existingWidgetCount >= maxNo) {
            toast(
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

            setLayout([...layout, newLayout]);
            setWidgets([...widgets, newWidgeDict]);
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

    // console.log(layout)
    return (
        <Box w={"100%"} h={"100%"} className={`fastboard-${colorMode}`}>
            <title>{appName}</title>
            <GridLayout
                className="layout"
                layout={layout}
                height={Math.min(1080, window.screen.availHeight)}
                cols={isLargerThan1280 ? 48 : 1}
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
                        allWidgets={ALL_WIDGETS}
                        appName={appName}
                        currentLayout={layout}
                        currentWidgets={widgets}
                        loadBoard={loadBoard}
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
                            settingsConfig={widgetDict.settings}
                            isStatic={getLayout(widgetDict.key)?.static || false}
                            WidgetElement={widgetObjReference[widgetDict.type]}
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
