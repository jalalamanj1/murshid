/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Application-wide UI zoom for Murshid using Electron's native
 * webContents zoom APIs (no CSS transforms, no image-viewer changes).
 *
 * Shortcuts (all require the Control modifier):
 *   Ctrl + Plus  (or Ctrl + "=") -> zoom in
 *   Ctrl + Minus                 -> zoom out
 *   Ctrl + 0                     -> reset to 100%
 *   Ctrl + Mouse Wheel           -> zoom in / out
 */

const MIN_ZOOM = 0.7; // 70%
const MAX_ZOOM = 1.5; // 150%
const ZOOM_STEP = 0.1; // 10% per step

let currentZoom = 1.0;

function round1(n) {
  return Math.round(n * 10) / 10;
}

function getZoom() {
  return currentZoom;
}

function applyZoom(win) {
  if (!win || win.isDestroyed() || !win.webContents || win.webContents.isDestroyed()) return;
  win.webContents.setZoomFactor(currentZoom);
}

function zoomIn(win) {
  currentZoom = round1(Math.min(MAX_ZOOM, currentZoom + ZOOM_STEP));
  applyZoom(win);
}

function zoomOut(win) {
  currentZoom = round1(Math.max(MIN_ZOOM, currentZoom - ZOOM_STEP));
  applyZoom(win);
}

function zoomReset(win) {
  currentZoom = 1.0;
  applyZoom(win);
}

function isZoomInKey(input) {
  return (
    input.key === '+' ||
    input.key === '=' ||
    input.code === 'Equal' ||
    input.code === 'NumpadAdd'
  );
}

function isZoomOutKey(input) {
  return (
    input.key === '-' ||
    input.code === 'Minus' ||
    input.code === 'NumpadSubtract'
  );
}

function isZoomResetKey(input) {
  return (
    input.key === '0' ||
    input.code === 'Digit0' ||
    input.code === 'Numpad0'
  );
}

/**
 * Handle a single before-input-event input.
 * Returns true when the event was consumed and should be prevented
 * from reaching the page (so Ctrl+wheel does not also scroll).
 */
function handleInput(win, input) {
  if (!input || !input.modifiers || !input.modifiers.includes('control')) return false;

  if (input.type === 'keyDown') {
    if (isZoomInKey(input)) {
      zoomIn(win);
      return true;
    }
    if (isZoomOutKey(input)) {
      zoomOut(win);
      return true;
    }
    if (isZoomResetKey(input)) {
      zoomReset(win);
      return true;
    }
    return false;
  }

  if (input.type === 'mouseWheel') {
    if (input.deltaY < 0) zoomIn(win);
    else zoomOut(win);
    return true;
  }

  return false;
}

/**
 * Attach zoom handling to a BrowserWindow. The chosen zoom level is kept
 * in memory for the whole session and re-applied on every page load.
 */
function install(win) {
  if (!win || win.__murshidZoomInstalled) return;
  win.__murshidZoomInstalled = true;
  win.webContents.on('before-input-event', (event, input) => {
    if (handleInput(win, input)) event.preventDefault();
  });
  win.webContents.on('did-finish-load', () => applyZoom(win));
}

module.exports = {
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
  getZoom,
  applyZoom,
  zoomIn,
  zoomOut,
  zoomReset,
  handleInput,
  install,
};
