//document.body.style.backgroundColor = "#f5f5f5"; 
    chrome.runtime.onMessage.addListener((request, sender) => {
        if (request.message === "messageSent") {
            chrome.runtime.sendMessage({ type: "selam", msg: "KickBot burada!" },response => {})
        }
        return true; 
    });
      
    chrome.runtime.sendMessage({ type: "selam", msg: "KickBot burada!" },response => {})