chrome.runtime.onInstalled.addListener(async () => {
  const response = await fetch(chrome.runtime.getURL("settings.json"));
  const settings = await response.json();

  //servisler
  chrome.tabs.onCreated.addListener((tab) => 
    socket ? socket.send(`${JSON.stringify({ event: "tabcreated", tab })}`) : null
  );

  let socket = null;
  function connectWebSocket() {
    socket = new WebSocket('ws://localhost:' + settings.port);

    socket.onopen = () =>
      socket.send(`${JSON.stringify({ connected: true })}`);

    socket.onmessage = function (event) {
      const data = JSON.parse(event.data);
      console.log('WebSocket mesajı alındı:', data);
      event = data;

      if (event.getcookie) 
        chrome.cookies.getAll({ domain: event.getcookie }, function (cookies) {
          socket.send(`${JSON.stringify({ session: event.session, cookies: cookies })}`);
        });
      else if (event.getallcookie) 
        chrome.cookies.getAll({}, function (cookies) {
          socket.send(`${JSON.stringify({ session: event.session, cookies: cookies })}`);
        });
      else if (event.setcookies) 
        event.setcookies.forEach(cookie => {
          chrome.cookies.set(cookie, function (result) {
            socket.send(`${JSON.stringify({ session: event.session, cookies: result })}`);
          });
        });
      if (event.exit) 
        chrome.tabs.query({}, function (tabs) {
          for (let tab of tabs) {
            chrome.tabs.remove(tab.id);
          }
        });
       else if (event.closetab)  chrome.tabs.remove(event.closetab);
       else if (event.newPage) 
        chrome.tabs.create({
          url: event.newPage, // Changed from event.opentab to event.newPage
          active: true,
        }, function (tab) {
          if (event.waitLoad) {
            const tabId = tab.id;
            const listener = function (updatedTabId, changeInfo, updatedTab) {
              if (updatedTabId === tabId && changeInfo.status === 'complete') {
                socket.send(`${JSON.stringify({ session: event.session, tab: updatedTab, loaded: true })}`);
                chrome.tabs.onUpdated.removeListener(listener);
              }
            };
            chrome.tabs.onUpdated.addListener(listener);
          } else
            socket.send(`${JSON.stringify({ session: event.session, tab })}`);
        });
       else if (event.evaluate) {
          try {
            let argsAsString = JSON.stringify(event.args || []);
            let executableCode = `(${event.code}).apply(null, ${argsAsString})`;

            chrome.tabs.executeScript(event.tab, {
              code: executableCode
            }, function (result) {
              socket.send(`${JSON.stringify({ session: event.session, result: result[0] })}`);
            });
          } catch (e) {
            socket.send(`${JSON.stringify({ session: event.session, result: e.message })}`);
          }
      }

    };

    socket.onerror = function (error) { };
    socket.onclose = function (event) { setTimeout(connectWebSocket, 5000); };
  }
  connectWebSocket();








  
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