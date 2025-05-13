const PearBrowser = require("./Pear")

async function main() {
    const browser = await PearBrowser({
        profileDir: "./profile",
        debug: false,
        autoclose: false,
    });

    const tab = await browser.newPage("file:///C:/Users/kubil/Desktop/Pear/test.html");

}

main().catch((error) => {
    console.error("Hata:", error);
});