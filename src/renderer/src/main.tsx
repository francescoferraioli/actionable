import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { SudoModeProvider } from './lib/sudo-mode';
import './styles.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element not found');
}

createRoot(root).render(
  <React.StrictMode>
    <SudoModeProvider>
      <App />
    </SudoModeProvider>
  </React.StrictMode>,
);
