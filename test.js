const PearBrowser = require("./Pear")

async function main() {
    const browser = await PearBrowser({
        profileDir: "./profile",
        debug: false,
        nosandbox: true,
        autoclose: false,
    });

    const tab = await browser.newPage("https://www.youtube.com/watch?v=tWzZhZU3sOI&t=0s");
await tab.screenshot({
  path: 'clip.png',
  clip: { x: 0, y: 0, width: 500, height: 300 }
});
await tab.screenshot({
    path:"test.png"
});

}
main().catch((error) => {
    console.error("Hata:", error);
});