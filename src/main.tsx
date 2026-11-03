// Live build: read sign-in tokens and payment / ID-check returns from the URL before the hash router starts.
import './lib/live/boot';
import { createRoot } from 'react-dom/client';
import './styles/app.css';
import { App } from './App';

const el = document.getElementById('root');
if (el) createRoot(el).render(<App />);
