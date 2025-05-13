const PearBrowser = require("./Pear")

async function main() {
    const browser = await PearBrowser({
        profileDir: "./profile",
        debug: false,
        nosandbox: true,
        autoclose: false,
    });

    const tab = await browser.newPage("https://www.google.com");
    await tab.screenshot({
        path: 'screenshot.jpg'
    });

}
main().catch((error) => {
    console.error("Hata:", error);
});