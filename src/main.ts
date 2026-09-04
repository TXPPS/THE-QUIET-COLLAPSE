import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/styles/hud.css';
import './ui/styles/touch.css';
import { App } from './app/App';
import { PROJECT_TITLE } from './config/project';

document.title = PROJECT_TITLE;
const root = document.getElementById('app');
if (!root) throw new Error('Missing #app root');
document.getElementById('boot-shell')?.remove();

const app = new App(root);
void app.boot();

declare global {
  interface Window {
    __tqc?: App;
  }
}
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) window.__tqc = app;
