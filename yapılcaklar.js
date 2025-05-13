   /* await newtab.waitForSelector("input[name='q']")

    await newtab.type("input[name='q']", "Pear Browser")
    await newtab.keyboard.press("Enter")
    await newtab.keyboard.down("ArrowDown")
    await newtab.keyboard.up("ArrowDown")

    await page.evaluate(() => {
        return document.querySelector("input[name='q']").value
    }).then((value) => {
        console.log("Input value:", value)
    })    
    
    useragent sonradan değiştirme
    sekmeye özel çözünülürlük
    port yerine uzaktan kontrol
    
    
    page.setRequestInterception(true);
    page.on('request', request => {
        if (request.resourceType() === 'document') {
            request.continue();
        } else {
            request.abort();
        }
    });

    pdf oluşturma
    dosya seçme
    emulasyonlar geolocation

    page.on('request', request => {
        console.log('Request:', request.url());
    });
    page.on('response', response => {
        console.log('Response:', response.url());
    });
    
    */
    //await newtab.waitForTimeout(5000),
    //await newtab.screenshot({path: "screenshot.png"})
    //stream screen
    //await newtab.mouse.click(100, 100)
    //await newtab.mouse.move(100, 100)
    //await newtab.mouse.down()
    //await newtab.mouse.up()
    //await newtab.mouse.wheel({deltaY: 100})
    //await newtab.mouse.wheel({deltaX: 100})

    //cookies
    //newtab.type("Pear Browser")
    //deb proxy
    //nasıl kullanıldığı