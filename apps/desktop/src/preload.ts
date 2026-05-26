import { contextBridge, ipcRenderer } from 'electron';

/** Expose type-safe API to renderer process */
contextBridge.exposeInMainWorld('om', {
  // Project
  project: {
    create: (name: string) => ipcRenderer.invoke('project:create', name),
    list: () => ipcRenderer.invoke('project:list'),
    open: (id: string) => ipcRenderer.invoke('project:open', id),
  },

  // Import
  import: {
    files: (paths: string[]) => ipcRenderer.invoke('import:files', paths),
    dialog: () => ipcRenderer.invoke('import:dialog'),
  },

  // Export
  export: {
    ontology: (format: string) => ipcRenderer.invoke('export:ontology', format),
  },

  // Agent
  agent: {
    send: (message: string) => ipcRenderer.invoke('agent:send', message),
    onStream: (callback: (event: { type: string; content?: string }) => void) => {
      ipcRenderer.on('agent:stream', (_e, data) => callback(data));
    },
  },

  // State
  state: {
    get: () => ipcRenderer.invoke('state:get'),
  },
});
