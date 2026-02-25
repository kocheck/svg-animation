import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorProvider } from './context/EditorContext.jsx';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <EditorProvider>
      <App />
    </EditorProvider>
  </StrictMode>,
);
