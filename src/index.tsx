import React from 'react';
import ReactDOM from 'react-dom';
import FastBoard from './FastBoard';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
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
  ReactDOM.render(
    <React.StrictMode>
      <FastBoard 
        appName="TestApp"
        widgetConfig={widgetConfig as WidgetConfig}
        widgetComponentMapping={widgetComponentMapping as WidgetComponentMapping}
      />
    </React.StrictMode>,
    rootElement
  );
}