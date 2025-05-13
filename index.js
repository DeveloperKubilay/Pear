const PearBrowser = require("./Pear")

async function main() {
    const browser = await PearBrowser({
        profileDir: "./profile",
        debug: false
    });

    const newtab = await browser.newPage("https://www.google.com", { waitLoad: true });

    /*
    // Page evaluate kullanımı
    const title = await newtab.evaluate(() => {
        return document.title;
    });
    
    console.log("Sayfa başlığı:", title);
    
    // Parametrelerle kullanım
    const sonuc = await newtab.evaluate((a, b) => {
        return a + b;
    }, 5, 10);
    
    console.log("Toplam:", sonuc);*/
}

main().catch((error) => {
    console.error("Hata:", error);
});