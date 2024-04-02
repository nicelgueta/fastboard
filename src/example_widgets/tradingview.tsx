import React from 'react';
import TradingViewWidget, { Themes, IntervalTypes, BarStyles } from 'react-tradingview-widget';
import { useColorMode } from '@chakra-ui/color-mode';
import { Box } from '@chakra-ui/layout';
import { stopPropagation } from '../components/common';
import { DefaultLayout } from '../layout';
import { WidgetElementProps } from '../interfaces';

interface TradingViewChartProps extends WidgetElementProps {
    hiddenSideBar: boolean;
    hiddenTopBar: boolean;
    hiddenLegend: boolean;
    chartInterval: IntervalTypes;
    barType: keyof typeof BarStyles;
    market: string;
}

const TradingViewChart: React.FC<TradingViewChartProps> = ({
    hiddenSideBar,
    hiddenTopBar,
    hiddenLegend,
    chartInterval,
    barType,
    market,
}) => {
    const { colorMode, toggleColorMode } = useColorMode();

    return (
        <Box h="100%">
            <TradingViewWidget
                theme={colorMode === "dark" ? Themes.DARK : Themes.LIGHT}
                locale="en"
                autosize
                hide_side_toolbar={hiddenSideBar}
                hide_top_toolbar={hiddenTopBar}
                hide_legend={hiddenLegend}
                interval={chartInterval}
                style={BarStyles[barType]}
                symbol={market}
                onMouseDown={stopPropagation}
                onTouchStart={stopPropagation}
            />
        </Box>
    )
}

export default TradingViewChart;

export const TradingViewChartConfig = {
    type: 'tradingView',
    disabled: false,
    name: 'TradingView Chart',
    description: 'A configurable TradingView chart for any symbol.',
    maxNo: 10,
    defaultLayout: {
        ...DefaultLayout,
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
            type: "input",
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
            options: [...Object.keys(IntervalTypes), 1, 3, 5, 15, 30, 60, 120, 180].map(x=>{return{
                label: x.toString(), value: x
            }}),
            default: IntervalTypes.D
        },
        {
            label: "Bar type",
            settingsKey: "barType",
            type: "select",
            options: Object.keys(BarStyles).map(x=>{return{
                label: x, value: x
            }}),
            default: "CANDLES"
        },
    ]
};