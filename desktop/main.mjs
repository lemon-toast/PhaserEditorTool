import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import { createServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let window,
  server,
  origin,
  quitting = false,
  dirty = false,
  allowClose = false;
const testing = process.env.EDITOR_DESKTOP_TEST === '1';
if (testing) app.setPath('userData', path.join(root, 'test-results', 'desktop-profile'));
app.setName('페이저 화면 에디터');
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  function discardChanges() {
    if (!dirty || allowClose) return true;
    const choice = dialog.showMessageBoxSync(window, {
      type: 'question',
      buttons: ['취소', '저장하지 않고 닫기'],
      defaultId: 0,
      cancelId: 0,
      title: '미저장 작업',
      message: '저장하지 않은 변경이 있습니다. 닫을까요?',
    });
    if (choice !== 1) return false;
    allowClose = true;
    dirty = false;
    return true;
  }
  ipcMain.on('editor:dirty', (event, value) => {
    if (window && event.sender === window.webContents && typeof value === 'boolean') {
      if (value) allowClose = false;
      dirty = value;
      window.setDocumentEdited(value);
    }
  });
  app.on('second-instance', () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });
  ipcMain.handle('editor:choose-project', async (event) => {
    if (
      !window ||
      event.sender !== window.webContents ||
      !event.senderFrame ||
      new URL(event.senderFrame.url).origin !== origin
    )
      throw new Error('허용되지 않는 요청입니다.');
    const result = await dialog.showOpenDialog(window, {
      title: '게임 프로젝트 폴더 선택',
      defaultPath: path.dirname(root),
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0] || null;
  });
  async function openWindow() {
    dirty = false;
    allowClose = false;
    window = new BrowserWindow({
      width: 1520,
      height: 980,
      minWidth: 1000,
      minHeight: 700,
      show: false,
      backgroundColor: '#11151c',
      title: '페이저 화면 에디터',
      webPreferences: {
        preload: path.join(root, 'desktop/preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event, url) => {
      if (new URL(url).origin !== origin) event.preventDefault();
    });
    window.on('close', (event) => {
      if (!discardChanges()) event.preventDefault();
    });
    window.webContents.on('will-prevent-unload', (event) => {
      if (discardChanges()) event.preventDefault();
    });
    window.once('ready-to-show', () => window.show());
    window.on('closed', () => {
      window = undefined;
    });
    await window.loadURL(origin);
  }
  app.whenReady().then(async () => {
    try {
      server = await createServer({
        root,
        configFile: path.join(root, 'vite.config.ts'),
        server: { host: '127.0.0.1', port: testing ? 0 : 5175, strictPort: true },
        clearScreen: false,
      });
      await server.listen();
      const address = server.httpServer.address();
      if (!address || typeof address === 'string') throw new Error('에디터를 시작할 수 없습니다.');
      origin = `http://127.0.0.1:${address.port}`;
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          {
            label: '프로젝트',
            submenu: [
              {
                label: '프로젝트 / 화면 선택',
                accelerator: 'CmdOrCtrl+O',
                click: () => window?.webContents.send('editor:show-projects'),
              },
              { type: 'separator' },
              { label: '종료', role: 'quit' },
            ],
          },
          {
            label: '편집',
            submenu: [
              { label: '복사', role: 'copy' },
              { label: '붙여넣기', role: 'paste' },
              { label: '잘라내기', role: 'cut' },
              { label: '모두 선택', role: 'selectAll' },
            ],
          },
          {
            label: '보기',
            submenu: [
              { label: '새로고침', role: 'reload' },
              { label: '확대', role: 'zoomIn' },
              { label: '축소', role: 'zoomOut' },
              { label: '기본 배율', role: 'resetZoom' },
              { label: '전체 화면', role: 'togglefullscreen' },
            ],
          },
        ]),
      );
      await openWindow();
      app.on('activate', () => {
        if (!window) void openWindow();
      });
    } catch (error) {
      dialog.showErrorBox('에디터 실행 실패', String(error));
      app.quit();
    }
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('before-quit', (event) => {
    if (!discardChanges()) {
      event.preventDefault();
      return;
    }
    if (server && !quitting) {
      event.preventDefault();
      quitting = true;
      server.close().finally(() => {
        server = undefined;
        app.quit();
      });
    }
  });
}
