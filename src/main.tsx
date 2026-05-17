import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Surface any crash visibly on the page so we can diagnose the white-screen issue
function showFatalError(msg: string) {
  document.body.style.cssText = 'margin:0;background:#0a0a0a;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:monospace';
  document.body.innerHTML = `<pre style="color:#f87171;font-size:13px;max-width:90vw;white-space:pre-wrap;padding:32px;border:1px solid rgba(248,113,113,0.3)">${msg}</pre>`;
}

window.onerror = (_msg, _src, _line, _col, err) => {
  showFatalError(`[uncaught error]\n${err?.stack ?? String(err)}`);
};

window.addEventListener('unhandledrejection', e => {
  showFatalError(`[unhandled rejection]\n${e.reason?.stack ?? String(e.reason)}`);
});

try {
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (err: unknown) {
  const e = err as Error;
  showFatalError(`[startup crash]\n${e?.stack ?? String(e)}`);
}
