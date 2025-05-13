   /* 
    port yerine uzaktan kontrol
    direk ws express'e bağlanabilsin
    cookies
    dosya seçme
    await newtab.screenshot({path: "screenshot.png"})
    pdf oluşturma
    emulasyonlar geolocation
    newtab.type("Pear Browser")
    deb proxy
    




    await newtab.type("input[name='q']", "Pear Browser")
    await newtab.keyboard.press("Enter")
    await newtab.keyboard.down("ArrowDown")
    await newtab.keyboard.up("ArrowDown")



    
    page.setRequestInterception(true);
    page.on('request', request => {
        if (request.resourceType() === 'document') {
            request.continue();
        } else {
            request.abort();
        }
    });



    page.on('request', request => {
        console.log('Request:', request.url());
    });
    page.on('response', response => {
        console.log('Response:', response.url());
    });
    
    */
    //await newtab.waitForTimeout(5000),
    //await newtab.mouse.click(100, 100)
    //await newtab.mouse.move(100, 100)
    //await newtab.mouse.down()
    //await newtab.mouse.up()
    //await newtab.mouse.wheel({deltaY: 100})
    //await newtab.mouse.wheel({deltaX: 100})

    //nasıl kullanıldığı