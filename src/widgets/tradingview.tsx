import React from 'react';
import TradingViewWidget, { Themes, IntervalTypes, BarStyles } from 'react-tradingview-widget';
import { useColorMode } from '@chakra-ui/color-mode';
import { Box } from '@chakra-ui/layout';
import { stopPropagation } from '../hooks/stoppropagation';

interface TradingViewChartProps {
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
