import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
