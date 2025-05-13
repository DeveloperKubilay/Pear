const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const EventEmitter = require('events');

module.exports = async function (app) {
  if (typeof app !== "object" || app === null || Array.isArray(app)) app = {};

  app = {
    browserPath:
      typeof app.browserPath == "string"
        ? app.browserPath
        : process.platform === "win32"
          ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
          : process.platform === "darwin"
            ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
            : "/usr/bin/google-chrome",

    profileDir:
      typeof app.profileDir == "string"
        ? path.join(process.cwd(), app.profileDir)
        : path.join(__dirname, "../profile"),

    args:
      typeof app.args == "object" && Array.isArray(app.args) ? app.args : [],

    debug: typeof app.debug == "boolean" ? app.debug : false,

    useragent: typeof app.useragent == "string" ? app.useragent : "",

    viewport: typeof app.viewport == "object" ? app.viewport : {},

    port: typeof app.port == "number" ? app.port : 9876,

    incognito: typeof app.incognito == "boolean" ? app.incognito : false
  };

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

  var settingsExtConfig = fs.readFileSync(
    path.join(extensionDir, "settings.json"),
    "utf8"
  );
  try { settingsExtConfig = JSON.parse(settingsExtConfig); } catch { settingsExtConfig = {} }
  settingsExtConfig.port = app.port;
  fs.writeFileSync(
    path.join(extensionDir, "settings.json"),
    JSON.stringify(settingsExtConfig, null, 2)
  );

  const chromeFlags = [
    `--user-data-dir="${app.profileDir}"`,
    `--load-extension="${extensionDir}"`, // Uzantıyı yükle
    "--no-first-run", // İlk çalıştırma karşılama ekranını atla
    "--no-default-browser-check", // Varsayılan tarayıcı kontrolünü atla
    "--disable-translate", // Çeviri önerisini kapat
    "--disable-infobars", // Bilgi çubuklarını kapat
    "--disable-notifications", // Bildirimleri devre dışı bırak
    "--disable-popup-blocking", // Pop-up engelleyiciyi devre dışı bırak
    "--start-maximized", // Tam ekran başlat
    "--enable-features=ExtensionsManifestV2", // Force enable Manifest V2 support

  ];

  if (app.viewport.width && app.viewport.height)
    chromeFlags.push(`--window-size=${app.viewport.width},${app.viewport.height}`);

  if (app.useragent)
    chromeFlags.push(`--user-agent=${app.useragent}`);

  if (app.incognito)
    chromeFlags.push(`--incognito`);

  chromeFlags.push(...app.args);


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

  process.on('exit', async () => await sendmsg({ exit: true }));

  process.on('SIGINT', async () => {
    await sendmsg({ exit: true });
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await sendmsg({ exit: true });
    process.exit(0);
  });

  process.on('uncaughtException', async (err) => {
    await sendmsg({ exit: true });
    process.exit(1);
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
    //if(app.debug) console.log("[Pear] ✅ A browser is ws connected");

    ws.on("message", (message) => {
      if (app.debug) console.log(`📩 Mesaj alındı: ${message}`);
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
    });

    ws.on("error", (error) => {
      if (app.debug) console.error(`[Pear] ❌ WebSocket error: ${error.message}`);
    });
  });


  const callbackmap = new Map()

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

  const out = {
    exit: async () => {
      await sendmsg({ exit: true });
      process.exit(0);
    },
    newPage: async (x, y) => {
      const data = await callbackmsg({
        newPage: x || "newPage",
        waitLoad: y.waitLoad
      }, y || {});
      data.tab.close = async () => await out.closeTab(data.tab.id);
      data.tab.exit = data.tab.close;
      data.tab.evaluate = async (fn, ...args) => {
        if (typeof fn != "function") throw new Error("fn must be a function");
        const result = await callbackmsg({
          evaluate: true,
          code: fn.toString(),
          args: args,
          tab: data.tab.id
        });
        if (result.error) throw new Error(result.error);
        return result.result;
      }
      data.tab.mouse ={
        wheel: async (x) => {
          if (typeof x != "object" || x === null || Array.isArray(x)) x = {};
          if (typeof x.deltaX != "number") x.deltaX = 0;
          if (typeof x.deltaY != "number") x.deltaY = 0;
          if(typeof x.x === "number") x.deltaX = x.x;
          if(typeof x.y === "number") x.deltaY = x.y;
          return await callbackmsg({
            mouse: true,
            wheel: true,
            deltaX: x.deltaX,
            deltaY: x.deltaY,
            tab: data.tab.id
          });
        }
      }

      return data.tab;
    },
    closeTab: async (x) => {
      if (typeof x != "number") new Error("Tab ID must be a number")
      return await callbackmsg({ closetab: x || "newPage" });
    },
    Events: Events
  }
  out.close = out.exit;


  return out;
};
