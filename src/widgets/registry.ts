import React from 'react';
import type { WidgetComponentMapping, WidgetConfig } from '../interfaces';
import TradingViewChart, { TradingViewChartConfig } from '../example_widgets/tradingview';
import { TableWidgetConfig } from './table/config';
import { EditorWidgetConfig } from './editor/config';
import { GraphWidgetConfig } from './graph/config';
import { RedditWidgetConfig } from './reddit/config';

/**
 * The app's built-in widget set: one entry per widget type, pairing its
 * BaseWidgetDict declaration with the component that renders it.
 *
 * Components for the heavy widgets (ag-grid, Monaco, duckdb, three.js) are lazy so an
 * empty board does not pay for them; WidgetPanel renders them inside a
 * Suspense boundary. The *config* objects are statically imported and must
 * stay dependency-free, so the Add tool menu can list every widget without
 * pulling in any of their code.
 */

const TableWidget = React.lazy(() => import('./table/TableWidget'));
const EditorWidget = React.lazy(() => import('./editor/EditorWidget'));
const GraphWidget = React.lazy(() => import('./graph/GraphWidget'));
const RedditWidget = React.lazy(() => import('./reddit/RedditWidget'));

export const widgetComponentMapping: WidgetComponentMapping = {
  tradingView: TradingViewChart,
  table: TableWidget,
  editor: EditorWidget,
  graph: GraphWidget,
  reddit: RedditWidget,
};

export const widgetConfig: WidgetConfig = [
  TradingViewChartConfig,
  TableWidgetConfig,
  EditorWidgetConfig,
  GraphWidgetConfig,
  RedditWidgetConfig,
];
