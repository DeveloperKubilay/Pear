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