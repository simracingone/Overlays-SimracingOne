const { contextBridge, ipcRenderer } = require("electron");

let currentEditMode = false;

contextBridge.exposeInMainWorld("overlayState", {
    onData: (callback) => ipcRenderer.on("iracing-data", (event, data) => callback(data)),
    
    getEditMode: () => currentEditMode,
    setEditMode: (value) => {
        currentEditMode = value;
        ipcRenderer.send("toggle-edit-mode", value);
    },
    
    quit: () => ipcRenderer.send("quit-app"), 

    // Écouteurs pour les raccourcis clavier
    onToggleEditMode: (callback) => ipcRenderer.on('toggle-edit-mode', (event, value) => callback(value)),
    onShowResetPopup: (callback) => ipcRenderer.on('show-reset-popup', () => callback()),
    onToggleVisibilityMenu: (callback) => ipcRenderer.on('toggle-visibility-menu', () => callback())
});