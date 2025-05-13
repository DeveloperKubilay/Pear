chrome.runtime.onInstalled.addListener(async () => {
  const response = await fetch(chrome.runtime.getURL("settings.json"));
  const settings = await response.json();

  let socket = null;


  var useragent = "";
  chrome.webRequest.onBeforeSendHeaders.addListener(
    function (details) {
      if (!useragent) return;
      const headers = details.requestHeaders;

      for (let i = 0; i < headers.length; i++) {
        if (headers[i].name.toLowerCase() === 'user-agent') {
          headers[i].value = useragent;
          break;
        }
      }
      return { requestHeaders: headers };
    },
    { urls: ["<all_urls>"] },
    ["blocking", "requestHeaders"]
  );

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
    setUserAgent: (event) => {
      useragent = event.setUserAgent;
      sendSocketMessage({ session: event.session, userAgent: event.userAgent });
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
        if (!event.dontwaitLoad) {
          handleTabLoading(tab.id, event.session);
        } else {
          sendSocketMessage({ session: event.session, tab });
        }
      });
    },
    uploadFile: (event) => {
      const { tab, selector, fileData } = event;

      chrome.tabs.executeScript(tab, {
        code: `
          (async function() {
            try {
              const input = document.querySelector("${selector.replace(/"/g, '\\"')}");
              if (!input || input.tagName.toLowerCase() !== 'input' || input.type.toLowerCase() !== 'file') {
                return { error: "Element is not a file input" };
              }
              const files = ${JSON.stringify(fileData)}.map(file => {
                const binaryString = atob(file.content);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                return new File([bytes], file.name, { type: file.type });
              });
              
              const dataTransfer = new DataTransfer();
              files.forEach(file => dataTransfer.items.add(file));
              input.files = dataTransfer.files;
              const event = new Event('change', { bubbles: true });
              input.dispatchEvent(event);
              
              return { 
                success: true, 
                fileNames: files.map(f => f.name) 
              };
            } catch (e) {  return { error: e.message }; } })()
        `
      }, (result) => {
        sendSocketMessage({
          session: event.session,
          result: result && result[0]
        });
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
    },

    setViewport: (event) => {
      const { tab, width, height } = event;
      chrome.tabs.get(tab, (tabInfo) => {
        if (chrome.runtime.lastError) {
          sendSocketMessage({
            session: event.session,
            error: chrome.runtime.lastError.message
          });
          return;
        }
        chrome.windows.update(tabInfo.windowId, {
          width: parseInt(width) + 16,
          height: parseInt(height) + 88
        }, () => {
          chrome.tabs.executeScript(tab, {
            code: `
                document.documentElement.style.width = '${parseInt(width)}px';
                document.documentElement.style.height = '${parseInt(height)}px';
                document.body.style.width = '${parseInt(width)}px';
                document.body.style.height = '${parseInt(height)}px';

                let viewport = document.querySelector('meta[name="viewport"]');
                if (!viewport) {
                  viewport = document.createElement('meta');
                  viewport.name = 'viewport';
                  document.head.appendChild(viewport);
                }
                viewport.content = 'width=${parseInt(width)}, height=${parseInt(height)}';
              `
          }, (result) => {
            sendSocketMessage({
              session: event.session
            });
          });
        });
      });
    },

    waitForSelector: (event) => {
      const { tab, selector, timeout = event.timeout ?? 30000 } = event;
      const startTime = Date.now();

      const checkElement = () => {
        chrome.tabs.executeScript(tab, {
          code: `!!document.querySelector("${selector.replace(/"/g, '\\"')}")`
        }, (result) => {
          if (chrome.runtime.lastError) return;

          if (result && result[0] === true) {
            sendSocketMessage({
              session: event.session,
              found: true
            });
            return;
          }

          if (Date.now() - startTime > timeout) {
            sendSocketMessage({
              session: event.session,
              error: `Timeout: Element "${selector}" not found within ${timeout}ms`
            });
            return;
          }

          setTimeout(checkElement, 100);
        });
      };

      checkElement();
    },
    getPageSource: (event) => {
      chrome.tabs.executeScript(event.tab, {
        code: 'document.documentElement.outerHTML'
      }, (result) => {
        sendSocketMessage({
          session: event.session,
          source: result && result[0]
        });
      });
    },
    select: (event) => {
      const { tab, selector, action, value, text, index } = event;

      let code = '';

      switch (action) {
        case 'selectByValue':
          code = `
          (function() {
            try {
              const selectElement = document.querySelector("${selector.replace(/"/g, '\\"')}");
              if (!selectElement || selectElement.tagName.toLowerCase() !== 'select') {
                return { error: "Element is not a select element" };
              }
              
              selectElement.value = "${value.replace(/"/g, '\\"')}";
              const event = new Event('change', { bubbles: true });
              selectElement.dispatchEvent(event);
              
              return { 
                success: true, 
                selected: selectElement.value,
                text: selectElement.options[selectElement.selectedIndex]?.text 
              };
            } catch (e) {
              return { error: e.message };
            }
          })()
        `;
          break;

        case 'selectByText':
          code = `
          (function() {
            try {
              const selectElement = document.querySelector("${selector.replace(/"/g, '\\"')}");
              if (!selectElement || selectElement.tagName.toLowerCase() !== 'select') {
                return { error: "Element is not a select element" };
              }
              
              for (let i = 0; i < selectElement.options.length; i++) {
                if (selectElement.options[i].text === "${text.replace(/"/g, '\\"')}") {
                  selectElement.selectedIndex = i;
                  const event = new Event('change', { bubbles: true });
                  selectElement.dispatchEvent(event);
                  return { 
                    success: true, 
                    selected: selectElement.value,
                    text: selectElement.options[i].text 
                  };
                }
              }
              
              return { error: \`Option with text "${text.replace(/"/g, '\\"')}" not found\` };
            } catch (e) {
              return { error: e.message };
            }
          })()
        `;
          break;

        case 'selectByIndex':
          code = `
          (function() {
            try {
              const selectElement = document.querySelector("${selector.replace(/"/g, '\\"')}");
              if (!selectElement || selectElement.tagName.toLowerCase() !== 'select') {
                return { error: "Element is not a select element" };
              }
              
              if (${index} < 0 || ${index} >= selectElement.options.length) {
                return { error: \`Index out of range (0-\${selectElement.options.length-1})\` };
              }
              
              selectElement.selectedIndex = ${index};
              const event = new Event('change', { bubbles: true });
              selectElement.dispatchEvent(event);
              
              return { 
                success: true, 
                selected: selectElement.value,
                text: selectElement.options[${index}].text 
              };
            } catch (e) {
              return { error: e.message };
            }
          })()
        `;
          break;

        case 'getOptions':
          code = `
          (function() {
            try {
              const selectElement = document.querySelector("${selector.replace(/"/g, '\\"')}");
              if (!selectElement || selectElement.tagName.toLowerCase() !== 'select') {
                return { error: "Element is not a select element" };
              }
              
              const options = [];
              for (let i = 0; i < selectElement.options.length; i++) {
                options.push({
                  index: i,
                  value: selectElement.options[i].value,
                  text: selectElement.options[i].text,
                  selected: selectElement.options[i].selected
                });
              }
              
              return { options };
            } catch (e) {
              return { error: e.message };
            }
          })()
        `;
          break;

        case 'getSelected':
          code = `
          (function() {
            try {
              const selectElement = document.querySelector("${selector.replace(/"/g, '\\"')}");
              if (!selectElement || selectElement.tagName.toLowerCase() !== 'select') {
                return { error: "Element is not a select element" };
              }
              
              if (selectElement.selectedIndex === -1) {
                return { selected: null };
              }
              
              return {
                selected: {
                  index: selectElement.selectedIndex,
                  value: selectElement.value,
                  text: selectElement.options[selectElement.selectedIndex].text
                }
              };
            } catch (e) {
              return { error: e.message };
            }
          })()
        `;
          break;
      }

      if (!code) return;

      chrome.tabs.executeScript(tab, { code }, (result) => {
        if (chrome.runtime.lastError) {
          sendSocketMessage({
            session: event.session,
            error: chrome.runtime.lastError.message
          });
          return;
        }

        sendSocketMessage({
          session: event.session,
          result: result && result[0]
        });
      });
    },
    click: (event) => {
      const { tab, selector, button = 0 } = event;

      chrome.tabs.executeScript(tab, {
        code: `
          (function() {
            try {
              const element = document.querySelector("${selector.replace(/"/g, '\\"')}");
              if (!element) return { error: "Element not found" };
              
              const rect = element.getBoundingClientRect();
              const x = rect.left + rect.width / 2;
              const y = rect.top + rect.height / 2;
              
              element.focus();
              const mouseEvent = new MouseEvent(${button} === 2 ? 'contextmenu' : 
                                               (${button} === 0 ? 'click' : 'auxclick'), {
                bubbles: true,
                cancelable: true,
                view: window,
                button: ${button},
                buttons: 1 << ${button},
                clientX: x,
                clientY: y
              });
              
              const result = element.dispatchEvent(mouseEvent);
              return { success: result };
            } catch (e) {
              return { error: e.message };
            }
          })()
        `
      }, (result) => {
        sendSocketMessage({
          session: event.session,
          result: result && result[0]
        });
      });
    },
    dragAndDrop: (event) => {
      const { tab, sourceSelector, targetSelector, fileName, fileContent, fileType } = event;
      const isFileDrop = fileName && fileContent && fileType;

      let code;

      if (isFileDrop) {
        code = `
      (function() {
        try {
          const target = document.querySelector("${targetSelector.replace(/"/g, '\\"')}");
          if (!target) return { error: "Target element not found" };
          
          const targetRect = target.getBoundingClientRect();
          
          // Create the events
          const dragEnterEvent = new DragEvent('dragenter', {
            bubbles: true,
            cancelable: true,
            clientX: targetRect.left + targetRect.width / 2,
            clientY: targetRect.top + targetRect.height / 2
          });
          
          const dragOverEvent = new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            clientX: targetRect.left + targetRect.width / 2,
            clientY: targetRect.top + targetRect.height / 2
          });
          
          const dropEvent = new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            clientX: targetRect.left + targetRect.width / 2,
            clientY: targetRect.top + targetRect.height / 2
          });
          
          // Create file from base64
          const binaryString = atob("${fileContent}");
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const file = new File([bytes], "${fileName}", { type: "${fileType}" });
          
          // Create and configure DataTransfer
          const dt = new DataTransfer();
          dt.items.add(file);
          
          Object.defineProperty(dragEnterEvent, 'dataTransfer', { value: dt });
          Object.defineProperty(dragOverEvent, 'dataTransfer', { value: dt });
          Object.defineProperty(dropEvent, 'dataTransfer', { value: dt });
          
          // Dispatch events
          target.dispatchEvent(dragEnterEvent);
          target.dispatchEvent(dragOverEvent);
          dragOverEvent.preventDefault();
          target.dispatchEvent(dropEvent);
          
          return { success: true };
        } catch (e) {
          return { error: e.message };
        }
      })()
    `;
      } else {
        code = `
      (function() {
        try {
          const source = document.querySelector("${sourceSelector.replace(/"/g, '\\"')}");
          const target = document.querySelector("${targetSelector.replace(/"/g, '\\"')}");
          
          if (!source) return { error: "Source element not found" };
          if (!target) return { error: "Target element not found" };
          
          const sourceRect = source.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();
          
          const dragStartEvent = new MouseEvent('dragstart', {
            bubbles: true,
            cancelable: true,
            clientX: sourceRect.left + sourceRect.width / 2,
            clientY: sourceRect.top + sourceRect.height / 2
          });
          
          const dragEnterEvent = new MouseEvent('dragenter', {
            bubbles: true,
            cancelable: true,
            clientX: targetRect.left + targetRect.width / 2,
            clientY: targetRect.top + targetRect.height / 2
          });
          
          const dragOverEvent = new MouseEvent('dragover', {
            bubbles: true,
            cancelable: true,
            clientX: targetRect.left + targetRect.width / 2,
            clientY: targetRect.top + targetRect.height / 2
          });
          
          const dropEvent = new MouseEvent('drop', {
            bubbles: true,
            cancelable: true,
            clientX: targetRect.left + targetRect.width / 2,
            clientY: targetRect.top + targetRect.height / 2
          });
          
          const dragEndEvent = new MouseEvent('dragend', {
            bubbles: true,
            cancelable: true,
            clientX: targetRect.left + targetRect.width / 2,
            clientY: targetRect.top + targetRect.height / 2
          });
          
          let dt = new DataTransfer();
          Object.defineProperty(dragStartEvent, 'dataTransfer', {
            value: dt
          });
          Object.defineProperty(dragEnterEvent, 'dataTransfer', {
            value: dt
          });
          Object.defineProperty(dragOverEvent, 'dataTransfer', {
            value: dt
          });
          Object.defineProperty(dropEvent, 'dataTransfer', {
            value: dt
          });
          Object.defineProperty(dragEndEvent, 'dataTransfer', {
            value: dt
          });
          
          source.dispatchEvent(dragStartEvent);
          target.dispatchEvent(dragEnterEvent);
          target.dispatchEvent(dragOverEvent);
          dragOverEvent.preventDefault();
          target.dispatchEvent(dropEvent);
          source.dispatchEvent(dragEndEvent);
          
          return { success: true };
        } catch (e) {
          return { error: e.message };
        }
      })()
    `;
      }

      chrome.tabs.executeScript(tab, { code }, (result) => {
        sendSocketMessage({
          session: event.session,
          result: result && result[0]
        });
      });
    },
    screenshot: (event) => {
      const { tab, options } = event;
      const { fullPage, type, quality, clip } = options || {};

      const captureOptions = { format: type || 'png' };
      if (quality && (type === 'jpeg' || type === 'webp')) {
        captureOptions.quality = quality;
      }

      if (fullPage) {
        chrome.tabs.executeScript(tab, {
          code: `
          (function() {
            const body = document.body;
            const html = document.documentElement;
            
            const height = Math.max(
              body.scrollHeight, body.offsetHeight,
              html.clientHeight, html.scrollHeight, html.offsetHeight
            );
            
            const width = Math.max(
              body.scrollWidth, body.offsetWidth,
              html.clientWidth, html.scrollWidth, html.offsetWidth
            );
            
            return { width, height };
          })()
        `
        }, (dimensions) => {
          if (chrome.runtime.lastError) {
            sendSocketMessage({
              session: event.session,
              error: chrome.runtime.lastError.message
            });
            return;
          }
          chrome.tabs.executeScript(tab, {
            code: 'const originalScroll = { x: window.scrollX, y: window.scrollY }; originalScroll;'
          }, (originalScroll) => {
            chrome.tabs.captureVisibleTab(null, captureOptions, (dataUrl) => {
              if (chrome.runtime.lastError) {
                sendSocketMessage({
                  session: event.session,
                  error: chrome.runtime.lastError.message
                });
                return;
              }
              chrome.tabs.executeScript(tab, {
                code: `window.scrollTo(${originalScroll[0].x}, ${originalScroll[0].y});`
              }, () => {
                const base64Data = dataUrl.replace(/^data:image\/(png|jpeg|webp);base64,/, '');
                sendSocketMessage({
                  session: event.session,
                  data: base64Data
                });
              });
            });
          });
        });
      } else if (clip) {
    chrome.tabs.captureVisibleTab(null, captureOptions, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendSocketMessage({
          session: event.session,
          error: chrome.runtime.lastError.message
        });
        return;
      }

      chrome.tabs.executeScript(tab, {
        code: `
        (function() {
          const img = new Image();
          img.src = "${dataUrl}";
          let completed = false;
          
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = ${clip.width};
            canvas.height = ${clip.height};
            
            ctx.drawImage(
              img,
              ${clip.x}, ${clip.y}, ${clip.width}, ${clip.height},
              0, 0, ${clip.width}, ${clip.height}
            );
            
            completed = true;
            return canvas.toDataURL('${type || 'image/png'}', ${quality ? quality / 100 : 1});
          };
          
          // Wait a moment for image to load and return result
          const startTime = Date.now();
          while (!completed && Date.now() - startTime < 5000) {
            // Small delay
          }
          
          return img.complete ? img.onload() : null;
        })()
        `
      }, (result) => {
        if (chrome.runtime.lastError || !result || !result[0]) {
          sendSocketMessage({
            session: event.session,
            error: chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Failed to crop image'
          });
          return;
        }

        const base64Data = result[0].replace(/^data:image\/(png|jpeg|webp);base64,/, '');
        sendSocketMessage({
          session: event.session,
          data: base64Data
        });
      });
    });
      } else {
        chrome.tabs.captureVisibleTab(null, captureOptions, (dataUrl) => {
          if (chrome.runtime.lastError) {
            sendSocketMessage({
              session: event.session,
              error: chrome.runtime.lastError.message
            });
            return;
          }

          const base64Data = dataUrl.replace(/^data:image\/(png|jpeg|webp);base64,/, '');
          sendSocketMessage({
            session: event.session,
            data: base64Data
          });
        });
      }
    },


  };


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