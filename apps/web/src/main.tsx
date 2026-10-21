import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

try {
  if (localStorage.getItem('korvex-theme') === 'light') document.documentElement.dataset.theme = 'light';
} catch {
  /* sem preferência salva */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
