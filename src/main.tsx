import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { EscapeStackProvider } from './hooks/useEscapeStack';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EscapeStackProvider>
      <App />
    </EscapeStackProvider>
  </StrictMode>
);
