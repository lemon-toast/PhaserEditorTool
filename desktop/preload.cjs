const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('editorDesktop', {
  chooseProjectFolder: () => ipcRenderer.invoke('editor:choose-project'),
  reportUnsavedChanges: (dirty) => ipcRenderer.send('editor:dirty', dirty === true),
  onShowProjects: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('editor:show-projects', handler);
    return () => ipcRenderer.removeListener('editor:show-projects', handler);
  },
});
