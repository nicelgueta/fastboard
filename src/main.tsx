import React from 'react';
import { createRoot } from 'react-dom/client';
import FastBoard from './FastBoard';
import 'dockview-react/dist/styles/dockview.css';
import './index.scss'
import './index.css';

// The app's built-in widget set lives in one place now - see widgets/registry.ts.
import { widgetComponentMapping, widgetConfig } from './widgets/registry';


const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <FastBoard
        appName="TestApp"
        widgetConfig={widgetConfig}
        widgetComponentMapping={widgetComponentMapping}
      />
    </React.StrictMode>
  );
}