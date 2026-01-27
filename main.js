const { app, BrowserWindow, ipcMain, globalShortcut } = require("electron");
const path = require("path");

let mainWindow;
let isEditMode = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 2560, height: 1440,
    frame: false, transparent: true, alwaysOnTop: true,
    skipTaskbar: true, backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    }
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.setIgnoreMouseEvents(true, { forward: true });
}

function basculerModeEdition() {
  isEditMode = !isEditMode;
  
  if (isEditMode) {
    mainWindow.setIgnoreMouseEvents(false);
    mainWindow.setFocusable(true);
    mainWindow.focus();
  } else {
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
  }

  // ON ENVOIE LE SIGNAL (très important : le nom du signal)
  mainWindow.webContents.send("toggle-edit-mode", isEditMode);
}

app.whenReady().then(() => {
  createWindow();

  // F12 -> Edition
  globalShortcut.register('CommandOrControl+Alt+F12', () => basculerModeEdition());

  // F9 -> Menu G
  globalShortcut.register('CommandOrControl+Alt+F9', () => {
    mainWindow.webContents.send("toggle-visibility-menu");
  });

  // F10 -> Reset
  globalShortcut.register('CommandOrControl+Alt+F10', () => {
    mainWindow.webContents.send("show-reset-popup");
  });
});