import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// 1. Matikan klik kanan (context menu) di seluruh aplikasi
document.addEventListener('contextmenu', (e) => e.preventDefault());

// 2. Matikan fungsi drag-and-drop bawaan browser pada elemen
document.addEventListener('dragstart', (e) => e.preventDefault());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
