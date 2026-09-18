import React from 'react';
import type { WidgetComponentMapping, WidgetConfig } from '../interfaces';
import TradingViewChart, { TradingViewChartConfig } from '../example_widgets/tradingview';
import { TableWidgetConfig } from './table/config';
import { EditorWidgetConfig } from './editor/config';

/**
 * The app's built-in widget set: one entry per widget type, pairing its
 * BaseWidgetDict declaration with the component that renders it.
 *
 * Components for the heavy widgets (ag-grid, Monaco, duckdb) are lazy so an
 * empty board does not pay for them; WidgetPanel renders them inside a
 * Suspense boundary. The *config* objects are statically imported and must
 * stay dependency-free, so the Add tool menu can list every widget without
 * pulling in any of their code.
 */

const TableWidget = React.lazy(() => import('./table/TableWidget'));
const EditorWidget = React.lazy(() => import('./editor/EditorWidget'));

export const widgetComponentMapping: WidgetComponentMapping = {
  tradingView: TradingViewChart,
  table: TableWidget,
  editor: EditorWidget,
};

export const widgetConfig: WidgetConfig = [
  TradingViewChartConfig,
  TableWidgetConfig,
  EditorWidgetConfig,
];
