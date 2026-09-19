import React from 'react';
import FastBoard from './FastBoard';
import 'dockview-react/dist/styles/dockview.css';

// The app's built-in widget set lives in one place - see widgets/registry.ts.
import { widgetComponentMapping, widgetConfig } from './widgets/registry';

/**
 * The "/board" route. Kept in its own module so App.tsx can React.lazy it:
 * dockview, ag-grid's wrapper and the widget registry are then fetched only
 * when someone opens the dashboard, not for the landing page.
 */
const BoardPage: React.FC = () => (
    <FastBoard
        appName="FastBoard"
        widgetConfig={widgetConfig}
        widgetComponentMapping={widgetComponentMapping}
    />
);

export default BoardPage;
