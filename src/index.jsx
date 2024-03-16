import * as React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './index.css'

const rootElement = document.getElementById('root')
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)