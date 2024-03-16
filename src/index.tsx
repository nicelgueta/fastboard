import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './index.scss'
import './index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
    rootElement
  );
}
