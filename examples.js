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
await tab.click("#clickArea");
    newtab.mouse.wheel({ deltaY: -500 })
    await newtab.waitForSelector("input[name='q']")

        await browser.setUserAgent("Sigma browser v1.0");//sayfaya özel değil
    await newtab.setViewport({ width: 900, height: 500 });//tek seferlik
        await newtab.uploadFile("#fileInput", filePath);
}




/*
    await tab.waitForSelector("#dropdown");
    
    // Get all options in the select
    const options = await tab.select.getOptions("#dropdown");
    console.log("Available options:", options);
    
    // Get currently selected option (initially it's the disabled option)
    const initialSelection = await tab.select.getSelected("#dropdown");
    console.log("Initially selected:", initialSelection);
    
    // Select option by value
    await tab.select.selectByValue("#dropdown", "option2");
    console.log("Selected Option 2 by value");
    
    // Select option by text
    await tab.select.selectByText("#dropdown", "Option 3");
    console.log("Selected Option 3 by text");
    
    // Select option by index (0-based, so 4 would be the 5th option)
    await tab.select.selectByIndex("#dropdown", 1);
    console.log("Selected Option 4 by index");
    
    // Verify final selection
    const finalSelection = await tab.select.getSelected("#dropdown");
    console.log("Final selection:", finalSelection);

*/


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