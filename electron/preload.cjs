const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveDialog: (defaultName) => ipcRenderer.invoke('dialog:save', defaultName),
  openDialog: (filters) => ipcRenderer.invoke('dialog:open', filters),
  pickFolder: () => ipcRenderer.invoke('dialog:pick-folder'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // ── Session Management ──────────────────────────────────────────
  createSession: (title) => ipcRenderer.invoke('session:create', title),
  deleteSession: (id) => ipcRenderer.invoke('session:delete', id),
  renameSession: (id, title) => ipcRenderer.invoke('session:rename', id, title),
  getSession: (id) => ipcRenderer.invoke('session:get', id),
  listSessions: () => ipcRenderer.invoke('session:list'),
  appendMessage: (sessionId, role, content) => ipcRenderer.invoke('session:append', sessionId, role, content),

  // ── Template Manager ────────────────────────────────────────────
  listTemplates: () => ipcRenderer.invoke('template:list'),
  loadTemplate: (recordType) => ipcRenderer.invoke('template:load', recordType),
  generateDocument: (recordType, values) => ipcRenderer.invoke('template:generate', recordType, values),
  validateTemplate: (recordType) => ipcRenderer.invoke('template:validate', recordType),

  // ── Export Service ──────────────────────────────────────────────
  exportDocx: (recordType, records) => ipcRenderer.invoke('export:docx', recordType, records),
  exportSpecialDocx: (category, record) => ipcRenderer.invoke('export:special-docx', category, record),
  saveFile: (fileName, base64) => ipcRenderer.invoke('export:save-file', fileName, base64),

  // ── Google Drive OAuth ───────────────────────────────────────────
  driveAuth: () => ipcRenderer.invoke('drive:auth'),

  // ── Record Cover Service ─────────────────────────────────────────
  cover: {
    listModels: () => ipcRenderer.invoke('cover:list-models'),
    getPreview: (modelId) => ipcRenderer.invoke('cover:get-preview', modelId),
    generate: (modelId, title) => ipcRenderer.invoke('cover:generate', modelId, title),
  },

  // ── Auto-updater ─────────────────────────────────────────────────
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update:status', (_e, data) => callback({ status: data.status, version: data.version }));
    ipcRenderer.on('update:progress', (_e, data) => callback({ status: 'progress', percent: data.percent }));
    ipcRenderer.on('update:error', (_e, data) => callback({ status: 'error', error: data.error || data.message || JSON.stringify(data) }));
  },
});
