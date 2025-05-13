chrome.runtime.onInstalled.addListener(async () => {
  const response = await fetch(chrome.runtime.getURL("settings.json"));
  const settings = await response.json();

  let socket = null;
  
  // WebSocket üzerinden mesaj göndermeyi kolaylaştıran yardımcı fonksiyon
  function sendSocketMessage(message) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  // Tab olaylarını dinle
  chrome.tabs.onCreated.addListener((tab) => {
    if (socket) sendSocketMessage({ event: "tabcreated", tab });
  });

  // Komutları işlemek için işleyiciler
  const commandHandlers = {
    getcookie: (event) => {
      chrome.cookies.getAll({ domain: event.getcookie }, (cookies) => {
        sendSocketMessage({ session: event.session, cookies });
      });
    },
    
    getallcookie: (event) => {
      chrome.cookies.getAll({}, (cookies) => {
        sendSocketMessage({ session: event.session, cookies });
      });
    },
    
    setcookies: (event) => {
      event.setcookies.forEach(cookie => {
        chrome.cookies.set(cookie, (result) => {
          sendSocketMessage({ session: event.session, cookies: result });
        });
      });
    },
    
    exit: () => {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => chrome.tabs.remove(tab.id));
      });
    },
    
    closetab: (event) => {
      chrome.tabs.remove(event.closetab);
    },
    
    newPage: (event) => {
      chrome.tabs.create({
        url: event.newPage,
        active: true,
      }, (tab) => {
        if (event.waitLoad) {
          handleTabLoading(tab.id, event.session);
        } else {
          sendSocketMessage({ session: event.session, tab });
        }
      });
    },
    
    evaluate: (event) => {
      try {
        let argsAsString = JSON.stringify(event.args || []);
        let executableCode = `(${event.code}).apply(null, ${argsAsString})`;

        chrome.tabs.executeScript(event.tab, {
          code: executableCode
        }, (result) => {
          sendSocketMessage({ 
            session: event.session, 
            result: result && result[0] 
          });
        });
      } catch (e) {
        sendSocketMessage({ session: event.session, error: e.message });
      }
    },
    
    mouse: (event) => {
      if (event.wheel) {
        chrome.tabs.executeScript(event.tab, {
          code: `window.scrollBy(${event.deltaX}, ${event.deltaY});`
        }, (result) => {
          sendSocketMessage({ session: event.session, result });
        });
      }
    }
  };

  // Tab yükleme işlemini takip etmek için yardımcı fonksiyon
  function handleTabLoading(tabId, sessionId) {
    const listener = (updatedTabId, changeInfo, updatedTab) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        sendSocketMessage({ session: sessionId, tab: updatedTab, loaded: true });
        chrome.tabs.onUpdated.removeListener(listener);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  }

  function connectWebSocket() {
    socket = new WebSocket('ws://localhost:' + settings.port);

    socket.onopen = () => sendSocketMessage({ connected: true });

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket mesajı alındı:', data);
        
        // Komut işleme mantığı - tek bir komut olarak ele al
        const commandType = Object.keys(data).find(key => 
          key !== 'session' && key !== 'args' && commandHandlers[key]
        );
        
        if (commandType && commandHandlers[commandType]) {
          commandHandlers[commandType](data);
        }
      } catch (error) {
        console.error('Mesaj işleme hatası:', error);
      }
    };

    socket.onerror = (error) => console.error('WebSocket error:', error);
    socket.onclose = () => setTimeout(connectWebSocket, 5000);
  }

  connectWebSocket();

  // Diğer kodlar korundu, yorum satırlarıyla kapatılmış kısımlar
  /*
    chrome.tabs.sendMessage(tabs[0].id, 
            {
                session:Date.now(),
                message: "messageSent"
            }, function(response) {
                console.log("Mesaj gönderildi:", response);
              socket.send(`${JSON.stringify({session:response.session})}`);
            })
  */

  /*
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
          if (request.type === "selam") {
            console.log("Content script'ten geldi:", request.msg);
        
            sendResponse("Eyvallah, aldım kral 👑");
          }
          return true;
        });*/
});