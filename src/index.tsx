import React from 'react';
import ReactDOM from 'react-dom';
import FastBoard from './FastBoard';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './index.scss'
import './index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.render(
    <React.StrictMode>
      <FastBoard 
        appName="TestApp"
        widgetConfig={[]}
        widgetComponentMapping={{}}
      />
    </React.StrictMode>,
    rootElement
  );
}
