const { app, BrowserWindow, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');

let mainWindow = null;
let tiktokAuthWindow = null;
let nextServerProcess = null;
let queueInterval = null;
let currentServerUrl = 'http://localhost:3000';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Single-instance enforcement
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

function setupUserDataDirs() {
  const userDataPath = app.getPath('userData');
  const dbPath = isDev
    ? path.resolve(__dirname, '..', 'prisma', 'dev.db')
    : path.join(userDataPath, 'dev.db');
  const uploadsPath = path.join(userDataPath, 'uploads');

  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }

  console.log(`[DATABASE DIAGNOSTIC] Absolute Database Path: ${dbPath}`);

  // Copy template database if user db does not exist (production only)
  if (!isDev && !fs.existsSync(dbPath)) {
    const templateCandidates = [
      path.join(__dirname, '..', 'prisma', 'dev.db'),
      path.join(__dirname, '..', 'dev.db'),
      path.join(process.resourcesPath, 'prisma', 'dev.db'),
      path.join(process.resourcesPath, 'dev.db'),
    ];

    for (const src of templateCandidates) {
      if (fs.existsSync(src)) {
        try {
          fs.copyFileSync(src, dbPath);
          console.log(`[Electron] Initialized user database from template: ${src}`);
          break;
        } catch (err) {
          console.error('[Electron] Failed to copy template db:', err);
        }
      }
    }
  }

  return { dbPath, uploadsPath };
}

function waitForServerReady(url, timeoutMs = 45000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 500) {
          resolve(true);
        } else {
          retry();
        }
      });

      req.on('error', () => retry());
      req.setTimeout(2000, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - startTime > timeoutMs) {
        reject(new Error(`Server readiness timeout after ${timeoutMs}ms at ${url}`));
      } else {
        setTimeout(check, 300);
      }
    };

    check();
  });
}

async function startNextServer(port, dbPath, uploadsPath) {
  const env = {
    ...process.env,
    PORT: String(port),
    HOSTNAME: '127.0.0.1',
    DATABASE_URL: `file:${dbPath.replace(/\\/g, '/')}`,
    UPLOAD_DIR: uploadsPath,
    APP_URL: `http://127.0.0.1:${port}`,
    NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
    NODE_ENV: isDev ? 'development' : 'production',
    SMOS_DESKTOP: 'true',
  };

  const projectRoot = path.join(__dirname, '..');

  if (isDev) {
    console.log(`[Electron] Starting Next.js dev server on port ${port}...`);
    nextServerProcess = spawn('npx.cmd', ['next', 'dev', '-p', String(port), '-H', '127.0.0.1'], {
      cwd: projectRoot,
      env,
      shell: true,
      windowsHide: true,
    });
  } else {
    console.log(`[Electron] Starting Next.js production server on port ${port}...`);
    const standaloneServer = path.join(projectRoot, '.next', 'standalone', 'server.js');
    if (fs.existsSync(standaloneServer)) {
      nextServerProcess = spawn(process.execPath, [standaloneServer], {
        cwd: path.join(projectRoot, '.next', 'standalone'),
        env,
        windowsHide: true,
      });
    } else {
      nextServerProcess = spawn('npx.cmd', ['next', 'start', '-p', String(port), '-H', '127.0.0.1'], {
        cwd: projectRoot,
        env,
        shell: true,
        windowsHide: true,
      });
    }
  }

  if (nextServerProcess) {
    nextServerProcess.stdout?.on('data', (data) => process.stdout.write(data));
    nextServerProcess.stderr?.on('data', (data) => process.stderr.write(data));
  }
}

function startBackgroundQueueProcessor(port) {
  if (queueInterval) clearInterval(queueInterval);
  queueInterval = setInterval(() => {
    const queueUrl = `http://127.0.0.1:${port}/api/queue/process`;
    http.get(queueUrl, (res) => {
      res.resume();
    }).on('error', () => {});
  }, 60000);
}

async function openTikTokOAuthWindow(authUrl) {
  if (tiktokAuthWindow && !tiktokAuthWindow.isDestroyed()) {
    tiktokAuthWindow.focus();
    return;
  }

  // Use a non-persistent, in-memory partition (no 'persist:' prefix)
  const partitionName = `tiktok_clean_session_${Date.now()}`;
  const cleanSession = session.fromPartition(partitionName);

  // Clear storage data asynchronously before launching URL
  try {
    await cleanSession.clearStorageData();
  } catch (err) {
    console.error('[Electron TikTok OAuth] Failed to clear storage:', err);
  }

  const chromeUserAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  tiktokAuthWindow = new BrowserWindow({
    width: 650,
    height: 800,
    parent: mainWindow || undefined,
    modal: false,
    title: 'TikTok Official Authorization',
    backgroundColor: '#070b14',
    autoHideMenuBar: true,
    webPreferences: {
      partition: partitionName,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      userAgent: chromeUserAgent,
    },
  });

  console.log('[TIKTOK POPUP] opened');
  console.log('[TIKTOK DEBUG] CLIENT KEY:', getClientKeyFromUrl(authUrl));
  console.log('[TIKTOK DEBUG] REDIRECT URI:', getRedirectUriFromUrl(authUrl));
  console.log('[TIKTOK DEBUG] AUTH URL:', authUrl);

  const isBlockedProtocol = (url) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return (
      lower.startsWith('bytedance://') ||
      lower.startsWith('snssdk') ||
      lower.startsWith('intent://') ||
      (!lower.startsWith('http://') && !lower.startsWith('https://'))
    );
  };

  const checkOAuthErrorInUrl = (urlStr) => {
    try {
      const u = new URL(urlStr);
      const err = u.searchParams.get('error');
      const errType = u.searchParams.get('error_type');
      if (err) {
        console.log('[TIKTOK DEBUG] OAUTH ERROR:', err);
      }
      if (errType) {
        console.log('[TIKTOK DEBUG] ERROR TYPE:', errType);
      }
    } catch (e) {}
  };

  let callbackHandled = false;

  const handleOAuthCallback = (navigationUrl) => {
    if (callbackHandled) return true;

    if (navigationUrl.includes('/tiktok/callback')) {
      callbackHandled = true;
      console.log('[TIKTOK CALLBACK] intercepted:', navigationUrl);
      checkOAuthErrorInUrl(navigationUrl);

      let pathAndQuery = '/tiktok/callback';
      try {
        const u = new URL(navigationUrl);
        pathAndQuery = u.pathname + u.search;
      } catch (e) {}

      const actualTargetUrl = `${currentServerUrl}${pathAndQuery}`;

      http.get(actualTargetUrl, (res) => {
        res.resume();
        console.log('[TIKTOK CALLBACK] server response:', res.statusCode);
        console.log('[TIKTOK CALLBACK] token exchange completed');
        console.log('[TIKTOK CALLBACK] connection saved');

        if (tiktokAuthWindow && !tiktokAuthWindow.isDestroyed()) {
          tiktokAuthWindow.close();
          console.log('[TIKTOK POPUP] closed');
        }

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(`${currentServerUrl}/accounts?tiktok_connected=true`);
          mainWindow.show();
          mainWindow.focus();
          console.log('[TIKTOK MAIN] accounts refreshed');
        }
      }).on('error', (err) => {
        console.error('[TIKTOK CALLBACK Error forwarding to server]:', err.message);
        if (tiktokAuthWindow && !tiktokAuthWindow.isDestroyed()) {
          tiktokAuthWindow.close();
        }
      });

      return true;
    }

    return false;
  };

  tiktokAuthWindow.webContents.on('did-start-navigation', (event, url) => {
    console.log('[TIKTOK OAUTH EVENT] did-start-navigation:', url);
    if (isBlockedProtocol(url)) {
      console.log('[TIKTOK CUSTOM PROTOCOL] bytedance dispatch intercepted');
      if (typeof event.preventDefault === 'function') event.preventDefault();
      return;
    }
    if (url.includes('/tiktok/callback')) {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      handleOAuthCallback(url);
    }
  });

  tiktokAuthWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    console.log('[TIKTOK OAUTH EVENT] will-navigate:', navigationUrl);
    if (isBlockedProtocol(navigationUrl)) {
      console.log('[TIKTOK CUSTOM PROTOCOL] bytedance dispatch intercepted');
      event.preventDefault();
      return;
    }
    if (navigationUrl.includes('/tiktok/callback')) {
      event.preventDefault();
      handleOAuthCallback(navigationUrl);
      return;
    }
  });

  tiktokAuthWindow.webContents.on('will-redirect', (event, navigationUrl) => {
    console.log('[TIKTOK OAUTH EVENT] will-redirect:', navigationUrl);
    if (isBlockedProtocol(navigationUrl)) {
      console.log('[TIKTOK CUSTOM PROTOCOL] bytedance dispatch intercepted');
      event.preventDefault();
      return;
    }
    if (navigationUrl.includes('/tiktok/callback')) {
      event.preventDefault();
      handleOAuthCallback(navigationUrl);
      return;
    }
  });

  tiktokAuthWindow.webContents.on('did-redirect-navigation', (event, navigationUrl) => {
    console.log('[TIKTOK OAUTH EVENT] did-redirect-navigation:', navigationUrl);
    if (isBlockedProtocol(navigationUrl)) {
      console.log('[TIKTOK CUSTOM PROTOCOL] bytedance dispatch intercepted');
      event.preventDefault();
      return;
    }
    if (navigationUrl.includes('/tiktok/callback')) {
      event.preventDefault();
      handleOAuthCallback(navigationUrl);
      return;
    }
  });

  tiktokAuthWindow.webContents.on('will-frame-navigate', (event) => {
    if (event.url && isBlockedProtocol(event.url)) {
      console.log('[TIKTOK CUSTOM PROTOCOL] bytedance dispatch intercepted');
      event.preventDefault();
    }
  });

  tiktokAuthWindow.webContents.on('did-navigate', (event, url, httpResponseCode) => {
    console.log(`[TIKTOK OAUTH EVENT] did-navigate: ${url} (Status: ${httpResponseCode})`);
  });

  tiktokAuthWindow.webContents.on('did-navigate-in-page', (event, url) => {
    console.log('[TIKTOK OAUTH EVENT] did-navigate-in-page:', url);
  });

  tiktokAuthWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    if (validatedURL.includes('/tiktok/callback') || isBlockedProtocol(validatedURL)) {
      return;
    }
    console.log(`[TIKTOK OAUTH EVENT] did-fail-load: ${validatedURL} (Error: ${errorCode} - ${errorDescription})`);
  });

  tiktokAuthWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const lower = message.toLowerCase();
    if (lower.includes('password') || lower.includes('cookie') || lower.includes('secret') || lower.includes('access_token')) {
      console.log(`[TIKTOK OAUTH EVENT] console-message: [FILTERED SENSITIVE LOG] (Level: ${level})`);
    } else {
      console.log(`[TIKTOK OAUTH EVENT] console-message: ${message} (Level: ${level}, Source: ${sourceId}:${line})`);
    }
  });

  tiktokAuthWindow.webContents.setWindowOpenHandler(({ url, disposition }) => {
    console.log(`[TIKTOK OAUTH EVENT] setWindowOpenHandler: ${url} (Disposition: ${disposition})`);
    checkOAuthErrorInUrl(url);
    if (isBlockedProtocol(url)) {
      console.log('[TIKTOK CUSTOM PROTOCOL] bytedance dispatch intercepted');
      return { action: 'deny' };
    }
    if (url.includes('/tiktok/callback')) {
      handleOAuthCallback(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  tiktokAuthWindow.loadURL(authUrl);

  tiktokAuthWindow.on('closed', () => {
    tiktokAuthWindow = null;
  });
}

function getClientKeyFromUrl(authUrl) {
  try { return new URL(authUrl).searchParams.get('client_key') || ''; } catch (e) { return ''; }
}

function getRedirectUriFromUrl(authUrl) {
  try { return new URL(authUrl).searchParams.get('redirect_uri') || ''; } catch (e) { return ''; }
}

function createMainWindow(serverUrl) {
  currentServerUrl = serverUrl;
  console.log('[MAIN WINDOW DIAGNOSTIC] Creating main window with serverUrl:', serverUrl);

  mainWindow = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Social Media OS',
    backgroundColor: '#070b14',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.on('did-start-navigation', (event, url, isSameDocument, isMainFrame) => {
    if (isMainFrame) {
      console.log('[MAIN WINDOW EVENT] did-start-navigation:', url);
    }
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    console.log('[MAIN WINDOW EVENT] will-navigate:', url);
    const isLocal = url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost');
    if (url.includes('/api/oauth/tiktok/connect')) {
      event.preventDefault();
      console.log('[TIKTOK POPUP] Intercepted connect request from mainWindow, opening popup...');
      openTikTokOAuthWindow(url);
      return;
    }
    if (!isLocal) {
      event.preventDefault();
      if (url.includes('tiktok.com')) {
        openTikTokOAuthWindow(url);
      } else {
        shell.openExternal(url);
      }
    }
  });

  mainWindow.webContents.on('will-redirect', (event, url) => {
    console.log('[MAIN WINDOW EVENT] will-redirect:', url);
  });

  mainWindow.webContents.on('did-redirect-navigation', (event, url) => {
    console.log('[MAIN WINDOW EVENT] did-redirect-navigation:', url);
  });

  mainWindow.webContents.on('did-navigate', (event, url, httpResponseCode) => {
    console.log(`[MAIN WINDOW EVENT] did-navigate: ${url} (HTTP ${httpResponseCode})`);
  });

  mainWindow.webContents.on('did-finish-load', async () => {
    console.log('[MAIN WINDOW EVENT] did-finish-load - Current URL:', mainWindow.webContents.getURL());
    console.log('[WINDOW STATE DIAGNOSTIC] isVisible:', mainWindow ? mainWindow.isVisible() : false);
    console.log('[WINDOW STATE DIAGNOSTIC] isMinimized:', mainWindow ? mainWindow.isMinimized() : false);
    console.log('[WINDOW STATE DIAGNOSTIC] getBounds:', mainWindow ? mainWindow.getBounds() : null);
    try {
      const html = await mainWindow.webContents.executeJavaScript('document.body ? document.body.outerHTML : "NO BODY"');
      const title = await mainWindow.webContents.executeJavaScript('document.title');
      const text = await mainWindow.webContents.executeJavaScript('document.body ? document.body.innerText : "NO INNER TEXT"');
      console.log('[DOM INSPECTION] Title:', title);
      console.log('[DOM INSPECTION] HTML length:', html ? html.length : 0);
      console.log('[DOM INSPECTION] Body snippet:', html ? html.slice(0, 300) : 'none');
      console.log('[DOM INSPECTION] InnerText snippet:', text ? text.slice(0, 300) : 'none');
    } catch (err) {
      console.error('[DOM INSPECTION ERROR]:', err);
    }
  });

  mainWindow.webContents.on('dom-ready', async () => {
    console.log('[MAIN WINDOW EVENT] dom-ready');
    console.log('[WINDOW STATE DIAGNOSTIC dom-ready] isVisible:', mainWindow ? mainWindow.isVisible() : false);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    console.log(`[MAIN WINDOW EVENT] did-fail-load: ${validatedURL} (Error ${errorCode}: ${errorDescription}, MainFrame: ${isMainFrame})`);
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[MAIN WINDOW ERROR] render-process-gone:', details);
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.error('[MAIN WINDOW ERROR] unresponsive');
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[MAIN WINDOW RENDER CONSOLE] [Level ${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log('[MAIN WINDOW EVENT] setWindowOpenHandler:', url);
    if (url.includes('/api/oauth/tiktok/connect') || url.includes('tiktok.com')) {
      openTikTokOAuthWindow(url);
      return { action: 'deny' };
    }
    if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  console.log('[MAIN WINDOW DIAGNOSTIC] Calling loadURL:', serverUrl);
  mainWindow.loadURL(serverUrl);

  mainWindow.once('ready-to-show', () => {
    console.log('[MAIN WINDOW EVENT] ready-to-show fired');
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  const { dbPath, uploadsPath } = setupUserDataDirs();
  const port = await getFreePort();
  const serverUrl = `http://127.0.0.1:${port}`;

  await startNextServer(port, dbPath, uploadsPath);

  try {
    await waitForServerReady(serverUrl);
    console.log(`[Electron] Next.js server ready at ${serverUrl}`);
    createMainWindow(serverUrl);
    startBackgroundQueueProcessor(port);
  } catch (err) {
    console.error('[Electron] Failed to start application:', err);
    stopNextServer();
    app.quit();
  }
});

function stopNextServer() {
  if (queueInterval) {
    clearInterval(queueInterval);
    queueInterval = null;
  }
  if (nextServerProcess) {
    console.log('[Electron] Terminating Next.js server process...');
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(nextServerProcess.pid), '/f', '/t']);
      } else {
        nextServerProcess.kill('SIGTERM');
      }
    } catch (e) {
      console.error('[Electron] Error stopping server process:', e);
    }
    nextServerProcess = null;
  }
}

app.on('before-quit', () => {
  stopNextServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopNextServer();
    app.quit();
  }
});
