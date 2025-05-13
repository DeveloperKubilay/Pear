const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const EventEmitter = require('events');

module.exports = async function (app) {
  // Parametre doğrulama yardımcı fonksiyonu
  function validateConfig(config, defaultValue, validator = () => true) {
    return validator(config) ? config : defaultValue;
  }

  if (typeof app !== "object" || app === null || Array.isArray(app)) app = {};

  app = {
    browserPath: validateConfig(
      app.browserPath,
      process.platform === "win32"
        ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
        : process.platform === "darwin"
          ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
          : "/usr/bin/google-chrome",
      (val) => typeof val === "string"
    ),

    profileDir: validateConfig(
      app.profileDir,
      path.join(__dirname, "../profile"),
      (val) => typeof val === "string"
    ),

    args: validateConfig(app.args, [], (val) => Array.isArray(val)),
    debug: validateConfig(app.debug, false, (val) => typeof val === "boolean"),
    useragent: validateConfig(app.useragent, "", (val) => typeof val === "string"),
    viewport: validateConfig(app.viewport, {}, (val) => typeof val === "object"),
    port: validateConfig(app.port, 9876, (val) => typeof val === "number"),
    incognito: validateConfig(app.incognito, false, (val) => typeof val === "boolean"),
    autoclose: validateConfig(app.autoclose, false, (val) => typeof val === "boolean"),
  };

  if (app.profileDir && typeof app.profileDir === "string") {
    app.profileDir = path.join(process.cwd(), app.profileDir);
  }

  const extensionDir = path.join(__dirname, "pearext");

  if (!fs.existsSync(app.profileDir)) {
    try {
      fs.mkdirSync(app.profileDir, { recursive: true });
    } catch (err) {
      console.error(
        `❌ [Pear] Profile creation failed file writing error: ${err.message}`
      );
      return;
    }
  }

  if (!fs.existsSync(extensionDir)) {
    console.error(
      `❌ Pear's core files have been deleted. Use the command "npm i pear"`
    );
    return;
  }

  // Ayarları yükleme ve güncelleme
  function loadAndUpdateSettings() {
    const settingsPath = path.join(extensionDir, "settings.json");
    let settings = {};
    
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    } catch {
      settings = {};
    }
    
    settings.port = app.port;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  }
  
  loadAndUpdateSettings();

  const chromeFlags = [
    `--user-data-dir="${app.profileDir}"`,
    `--load-extension="${extensionDir}"`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-translate",
    "--disable-infobars",
    "--disable-notifications",
    "--disable-popup-blocking",
    "--start-maximized",
    "--enable-features=ExtensionsManifestV2",
  ];

  if (app.viewport.width && app.viewport.height)
    chromeFlags.push(`--window-size=${app.viewport.width},${app.viewport.height}`);

  if (app.useragent)
    chromeFlags.push(`--user-agent=${app.useragent}`);

  if (app.incognito)
    chromeFlags.push(`--incognito`);

  chromeFlags.push(...app.args);

  // Tarayıcıyı başlat
  exec(`"${app.browserPath}" ${chromeFlags.join(" ")}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ [Pear] failed to launch browser: ${error}`);
      return;
    }
    if (app.debug) {
      if (stdout) console.log(`[Pear] stdout: ${stdout}`);
      if (stderr) console.error(`[Pear] stderr: ${stderr}`);
    }
  });

  async function sendmsg(x) {
    const message = JSON.stringify(x);
    if (wss.clients.size > 0) {
      await wss.clients.forEach(async (client) => {
        if (client.readyState === WebSocket.OPEN) {
          await client.send(message);
        }
      });
    }
  }

  // Çıkış işlemlerini yönetmek için ortak fonksiyon
  async function handleExit(exitCode = 0) {
    await sendmsg({ exit: true });
    process.exit(exitCode);
  }

  // Süreç olayları için tek bir yönetim yaklaşımı
  process.on('exit', async () => await sendmsg({ exit: true }));
  process.on('SIGINT', async () => await handleExit(0));
  process.on('SIGTERM', async () => await handleExit(0));
  process.on('uncaughtException', async (err) => {
    console.error('Uncaught exception:', err);
    await handleExit(1);
  });

  const wss = new WebSocket.Server({ port: app.port });
  var browserStarted = false;

  let browserReadyResolve = null;
  const browserReadyPromise = new Promise((resolve) => {
    if (browserStarted) {
      resolve(true);
    } else {
      browserReadyResolve = resolve;
    }
  });

  const Events = new EventEmitter();

  wss.on("connection", (ws) => {
    ws.on("message", (message) => {
      if (app.debug) console.log(`📩 Mesaj alındı: ${message}\n\n`);
      var parsedMessage = {};
      try {
        parsedMessage = JSON.parse(message);
      } catch (error) { return; }

      if (parsedMessage.connected) {
        browserStarted = true;
        if (app.debug) console.log("[Pear] ✅ Browser started and connected");
        // Notify any waiting promises that the browser has started
        if (browserReadyResolve) {
          browserReadyResolve(true);
          browserReadyResolve = null;
        }
      }

      //events
      if (parsedMessage.event == "tabcreated") {
        Events.emit("tabcreated", parsedMessage.tab);
      }

      if (callbackmap.has(parsedMessage.session)) {
        const { resolve } = callbackmap.get(parsedMessage.session);
        callbackmap.delete(parsedMessage.session);
        resolve(parsedMessage);
      }
    });

    ws.on("close", () => {
      if (app.debug) console.log("[Pear]🔌 Connection lost");
          if (wss.clients.size === 0) {
          wss.close(() => {
            if (app.debug) console.log("[Pear] WebSocket sunucusu kapatıldı");
            if(app.autoclose) process.exit(0);
          });
    }
    });

    ws.on("error", (error) => {
      if (app.debug) console.error(`[Pear] ❌ WebSocket error: ${error.message}`);
    });
  });

  const callbackmap = new Map();

  function randomidgenerator() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  async function callbackmsg(x, y) {
    const session = randomidgenerator();
    x.session = session;
    const promise = new Promise((resolve, reject) => {
      callbackmap.set(session, { resolve, reject });
      setTimeout(() => {
        if (callbackmap.has(session)) {
          callbackmap.delete(session);
          reject(new Error("Operation timed out after 30 seconds"));
        }
      }, y?.timeout || 30 * 1000);
    });
    await sendmsg(x);
    return await promise;
  }

  await browserReadyPromise;

  // Tab işlemleri için genişletilebilir yapı oluştur
  function createTabMethods(tabId) {
    return {
      close: async () => await out.closeTab(tabId),
      exit: async () => await out.closeTab(tabId),
      evaluate: async (fn, ...args) => {
        if (typeof fn != "function") throw new Error("fn must be a function");
        const result = await callbackmsg({
          evaluate: true,
          code: fn.toString(),
          args: args,
          tab: tabId
        });
        if (result.error) throw new Error(result.error);
        return result.result;
      },
      mouse: {
        wheel: async (x) => {
          if (typeof x != "object" || x === null || Array.isArray(x)) x = {};
          const deltaX = typeof x.deltaX === "number" ? x.deltaX : (typeof x.x === "number" ? x.x : 0);
          const deltaY = typeof x.deltaY === "number" ? x.deltaY : (typeof x.y === "number" ? x.y : 0);
          return await callbackmsg({
            mouse: true,
            wheel: true,
            deltaX,
            deltaY,
            tab: tabId
          });
        }
      },
      waitForSelector: async (selector, options = {}) => {
        if (typeof selector != "string") throw new Error("Selector must be a string");
        const timeout = options.timeout || 30000;
        const result = await callbackmsg({
          waitForSelector: true,
          selector,
          timeout,
          tab: tabId
        });
        if (result.error) throw new Error(result.error);
        return result.found;
      },
      setViewport: async (viewport) => {
        if (typeof viewport != "object" || viewport === null || Array.isArray(viewport)) throw new Error("Viewport must be an object");
        const width = typeof viewport.width === "number" ? viewport.width : 800;
        const height = typeof viewport.height === "number" ? viewport.height : 600;
        return await callbackmsg({
          setViewport: true,
          width,
          height,
          tab: tabId
        });
      },

    }
  }

  const out = {
    exit: async () => await handleExit(0),
    setUserAgent: async (userAgent) => {
      return await callbackmsg({
        setUserAgent: userAgent,
      });
    },
    newPage: async (x, y = {}) => {
      const data = await callbackmsg({
        newPage: x || "newPage",
        dontwaitLoad: y.dontwaitLoad
      }, y);
      
      // Tab metodlarını ekle
      Object.assign(data.tab, createTabMethods(data.tab.id));
      return data.tab;
    },
    closeTab: async (x) => {
      if (typeof x != "number") throw new Error("Tab ID must be a number");
      return await callbackmsg({ closetab: x });
    },
    Events: Events
  };
  out.close = out.exit;

  return out;
};
