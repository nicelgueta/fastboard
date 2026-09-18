import React from 'react';
import { createRoot } from 'react-dom/client';
import FastBoard from './FastBoard';
import 'dockview-react/dist/styles/dockview.css';
import './index.scss'
import './index.css';

// widgets
import TradingViewChart, { TradingViewChartConfig } from './example_widgets/tradingview';
import { WidgetComponentMapping, WidgetConfig } from './interfaces';

const widgetComponentMapping = {
  tradingView: TradingViewChart,
}

const widgetConfig = [
  TradingViewChartConfig,
]


const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <FastBoard
        appName="TestApp"
        widgetConfig={widgetConfig as WidgetConfig}
        widgetComponentMapping={widgetComponentMapping as WidgetComponentMapping}
      />
    </React.StrictMode>
  );
}