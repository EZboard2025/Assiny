#!/usr/bin/env node
/**
 * Patches whatsapp-web.js Client.js to fix the hasSynced timing issue.
 *
 * Bug: WhatsApp Web (since ~Jan 28, 2026) can have AppState.hasSynced already
 * set to true before whatsapp-web.js registers its change listener. This means
 * the 'ready' event never fires because the library is waiting for a state
 * change that already happened.
 *
 * Fix: Check initial hasSynced state before registering the listener, and only
 * trigger the callback when hasSynced transitions to true.
 *
 * See: https://github.com/pedroslopez/whatsapp-web.js/issues/5758
 */

const fs = require('fs');
const path = require('path');

const CLIENT_JS = path.join(__dirname, '..', 'node_modules', 'whatsapp-web.js', 'src', 'Client.js');

const ORIGINAL = `window.AuthStore.AppState.on('change:state', (_AppState, state) => { window.onAuthAppStateChangedEvent(state); });
            window.AuthStore.AppState.on('change:hasSynced', () => { window.onAppStateHasSyncedEvent(); });`;

const PATCHED = `const appState = window.AuthStore.AppState;
            appState.on('change:state', (_AppState, state) => { window.onAuthAppStateChangedEvent(state); });
            appState.on('change:hasSynced', (_AppState, hasSynced) => { if (hasSynced) { window.onAppStateHasSyncedEvent(); } });
            if (appState.hasSynced) { window.onAppStateHasSyncedEvent(); }`;

try {
  if (!fs.existsSync(CLIENT_JS)) {
    console.log('[patch-wwebjs] Client.js not found, skipping (whatsapp-web.js not installed)');
    process.exit(0);
  }

  let content = fs.readFileSync(CLIENT_JS, 'utf8');

  if (content.includes('if (appState.hasSynced)')) {
    console.log('[patch-wwebjs] Already patched, skipping');
    process.exit(0);
  }

  if (!content.includes(ORIGINAL)) {
    console.warn('[patch-wwebjs] WARNING: Original code pattern not found. The library may have been updated.');
    console.warn('[patch-wwebjs] Check if the hasSynced fix is still needed.');
    process.exit(0);
  }

  content = content.replace(ORIGINAL, PATCHED);
  fs.writeFileSync(CLIENT_JS, content, 'utf8');
  console.log('[patch-wwebjs] Successfully patched Client.js (hasSynced timing fix)');
} catch (err) {
  console.error('[patch-wwebjs] Error patching:', err.message);
  process.exit(1);
}
