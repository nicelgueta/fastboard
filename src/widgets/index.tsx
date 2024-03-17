import React from 'react';
import { IntervalTypes, BarStyles } from 'react-tradingview-widget';
import { VStack, Center } from '@chakra-ui/layout';

// Widgets
import DataTableWidget from './data-table';
import TradingViewChart from './tradingview';


import { BaseWidgetDict, BaseLayout } from '../interfaces';

import FBInput from '../components/primitive/Input';
import FBNumberInput from '../components/primitive/NumberInput';
import FBSelect from '../components/primitive/Select';
import FBSwitch from '../components/primitive/Switch';
import FBMultiSelect from '../components/primitive/MultiSelect';
import FBSlider from '../components/primitive/Slider';
import { MdGraphicEq } from 'react-icons/md';


export const DEFAULT_LAYOUT: BaseLayout = {
    x: 12,
    y: 2,
    minW: 7,
    w: 10,
    maxW: 20,
    minH: 8,
    h: 10,
    maxH: 96,
    static: false
}

export const ALL_WIDGETS: BaseWidgetDict[] = [
    {
        type: 'testpad',
        disabled: false,
        name: 'TestPad',
        description: `
            This is a blank widget. You can add more widgets by clicking the 
            "Add Widget" button in the top right corner of the screen.
        `,
        maxNo: 20,
        defaultLayout:{
            ...DEFAULT_LAYOUT,
            minW: 7,
            w: 20,
            maxW: 20,
            minH: 8,
            h: 20,
            maxH: 96,
            static: false
        },
        settings:[]
    },
    {
        type: 'datatable',
        disabled: false,
        name: 'DataTable',
        description: `
            This widget displays a table of data. You can use the search bar to 
            filter the table by text.
        `,
        maxNo: 20,
        defaultLayout: {
            ...DEFAULT_LAYOUT,
            minW: 6,
            w: 20,
            maxW: 40,
            minH: 8,
            h: 20,
            maxH: 96,
            static: false
        },
        settings: [
            {
                label: "Caption",
                settingsKey: "caption",
                tooltip: "The captions for the dataset being displayed",
                type: "free-text",
            }
        ]
    },
    {
        type: 'tradingViewChart',
        disabled: false,
        name: 'TradingView Chart',
        description: 'A configurable TradingView chart for any symbol.',
        maxNo: 10,
        defaultLayout: {
            ...DEFAULT_LAYOUT,
            minW: 6,
            w: 20,
            maxW: 40,
            minH: 8,
            h: 20,
            maxH: 96,
            static: false
        },
        settings:[
            {
                label: "Market",
                settingsKey: "market",
                tooltip: `Use TradingView format of [exchange]:[market]. 
                    To explore options from within TradingView, unhide the TradingView bar in 
                    the config below and use the symbol search to find more markets. NB, 
                    charts configured from within the TradingView search cannot be saved and will 
                    revert to your previous configuration unless you configure the market here.`,
                type: "free_text",
                default: "COINBASE:BTCUSD"
            },
            {
                label: "Hide TradingView bar",
                settingsKey: "hiddenTopBar",
                type: "switch",
                default: true
            },
            {
                label: "Hide drawing tools",
                settingsKey: "hiddenSideBar",
                type: "switch",
                default: true
            },
            {
                label: "Hide legend",
                settingsKey: "hiddenLegend",
                type: "switch",
                default: false
            },
            {
                label: "Chart interval",
                settingsKey: "chartInterval",
                type: "select",
                options: [...Object.keys(IntervalTypes), 1, 3, 5, 15, 30, 60, 120, 180],
                default: IntervalTypes.D
            },
            {
                label: "Bar type",
                settingsKey: "barType",
                type: "select",
                options: Object.keys(BarStyles),
                default: "CANDLES"
            },
        ]
    }
]

export const widgetObjReference: { [key: string]: React.FC } = {
    testpad: ()=>{
        const typ = "info";
        return (
        <Center h="100%" w="100%">
            <VStack
                w="50%"
            >
                <FBInput 
                    typ={typ}
                />
                <FBNumberInput 
                    typ={typ}
                />
                <FBInput 
                    typ={typ}
                    type="date"
                />
                <FBSelect
                    typ={typ}
                    placeholder='Select an option'
                    options={[
                        {label: "Option 1", value: "option1"},
                        {label: "Option 2", value: "option2"},
                        {label: "Option 3", value: "option3"}
                    ]}
                />
                <FBSwitch 
                    left="OFF"
                    typ={typ}
                    right="ON"
                />
                <FBMultiSelect
                    typ={typ}
                    options={[
                        {"label":"Option 1","value":"option1"},
                        {"label":"Option 2","value":"option2"}
                    ]}
                />
                <FBSlider 
                    leftUnitLabel='£'
                    marks={[25, 50, 75]}
                    icon={MdGraphicEq}
                    typ={typ}
                    min={0}
                    max={100}
                    step={5}
                />
            </VStack>
        </Center>
    )},
    datatable: DataTableWidget,
    tradingViewChart: TradingViewChart
}