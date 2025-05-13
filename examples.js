async function main() {
    const newtab = await browser.newPage("https://www.google.com/search?q=oe", { dontwaitLoad: true });
    setTimeout(async () => {

        await newtab.close()
    }, 5000)

    await browser.close()
    const browser = await PearBrowser({
        profileDir: "./profile",
        debug: true
    });
    browser.Events.on("tabcreated", (msg) => {
        console.log("[Pear] Tab oluşturuldu:", JSON.stringify(msg));
    });


    const sonuc = await newtab.evaluate((a, b) => {
        return a + b;
    }, 5, 10);

    newtab.mouse.wheel({ deltaY: -500 })
    await newtab.waitForSelector("input[name='q']")

        await browser.setUserAgent("Sigma browser v1.0");//sayfaya özel değil
    await newtab.setViewport({ width: 900, height: 500 });//tek seferlik
}




/*

const PearBrowser = require("./Pear");
const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);

app.get('/', (req, res) => {
  res.send('Pear Browser API çalışıyor');
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`HTTP ve WebSocket sunucusu ${PORT} portunda çalışıyor`);
});

async function main() {
    const browser = await PearBrowser({
        profileDir: "./profile",
        debug: true,
        autoclose: false,
        server: server, 
        port: PORT   
    });

    const newtab = await browser.newPage("https://www.whatismybrowser.com/detect/what-is-my-user-agent/");
}

main().catch((error) => {
    console.error("Hata:", error);
});
*/