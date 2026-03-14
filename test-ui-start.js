const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('dialog', async dialog => {
        console.log('ALERT:', dialog.message());
        await dialog.accept();
    });
    
    page.on('console', msg => console.log('LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    
    await page.goto('http://localhost:3000');
    
    // Clear localStorage to prevent auto-login loop from breaking the test flow
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const randomNum = Math.floor(Math.random() * 100000);
    const testUser = `TestAgent${randomNum}`;
    
    console.log(`Registering as ${testUser}...`);
    await page.type('#username', testUser);
    await page.type('#password', 'Qwerty1234');
    
    console.log('Clicking Register...');
    await page.click('#btn-register');
    
    await new Promise(r => setTimeout(r, 1000));
    
    console.log('Clicking Login...');
    await page.click('button[type="submit"]');
    
    await page.waitForSelector('#lobby-view.active');
    console.log('In lobby view!');
    
    console.log('Clicking create room...');
    await page.click('#btn-create-room');
    
    await page.waitForSelector('#room-view.active');
    console.log('Room view active!');
    
    await new Promise(r => setTimeout(r, 1000));
    
    console.log('Clicking START MISSION...');
    await page.click('#btn-start');
    
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('Checking view status...');
    const isGameActive = await page.$eval('#game-view', el => el.classList.contains('active'));
    console.log('Is game active?', isGameActive);
    
    // Capture screenshot of the UI state
    await page.screenshot({ path: 'game_started_test.png', fullPage: true });
    console.log('Screenshot saved to game_started_test.png');
    
    await browser.close();
    process.exit(0);
})().catch(e => {
    console.log("CRASH:", e);
    process.exit(1);
});
