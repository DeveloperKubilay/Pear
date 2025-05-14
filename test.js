const pearBrowser = require("./Pear")

async function main() {
const browser = await pearBrowser({
    profileDir: "./profile",
    debug: false,
    nosandbox: true,
    useChromium: true,
    autoclose: false,
});

const newtab = await browser.newPage("https://www.google.com/search?q=sa");


// Use keyboard actions
// Example usage
await newtab.focus("input[name='q']"); // Focus on Google's search input field
await newtab.type("search query");  // Type into the focused element
await newtab.keyboard.press("Enter");
await newtab.keyboard.down("ArrowDown");
await newtab.keyboard.up("ArrowDown");
}
main().catch((error) => {
    console.error("Hata:", error);
});