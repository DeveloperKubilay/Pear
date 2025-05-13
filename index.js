const PearBrowser = require("./Pear")

const express = require("express");
const app = express();
app.listen(3000)

async function main() {
    const browser = await PearBrowser({
        profileDir: "./profile",
        debug: true,
        autoclose:false,
    });

    const newtab = await browser.newPage("https://www.whatismybrowser.com/detect/what-is-my-user-agent/");



}

main().catch((error) => {
    console.error("Hata:", error);
});