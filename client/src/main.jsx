import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/bangers/latin-400.css';
import '@fontsource-variable/fredoka/wght.css';
import App from './App.jsx';
import './styles/global.css';
import './styles/comic.css';
import './styles/landing.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
