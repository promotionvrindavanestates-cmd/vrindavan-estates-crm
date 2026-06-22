const puppeteer = require('puppeteer-core');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const siteUrl = 'https://vrindavan-estates-crm-frontend.vercel.app';
const brainDir = 'C:\\Users\\abhin\\.gemini\\antigravity\\brain\\49fb3c83-a305-4b82-8e4b-d44c03e54c5f';

async function run() {
  console.log('Launching Google Chrome...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--disable-gpu', '--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Listen to page console and errors
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.stack || err.message));
  
  // Set desktop viewport
  await page.setViewport({ width: 1400, height: 950 });

  console.log(`Navigating to ${siteUrl}...`);
  await page.goto(siteUrl, { waitUntil: 'networkidle2' });

  console.log('Waiting for login fields...');
  await page.waitForSelector('input[placeholder="Enter username"]');
  
  console.log('Entering login credentials...');
  await page.type('input[placeholder="Enter username"]', 'admin');
  await page.type('input[placeholder="Enter password"]', 'admin123');

  console.log('Clicking sign in...');
  await page.click('button[type="submit"]');

  console.log('Waiting for Daybook dashboard to load...');
  // 1. Wait for the KPI row to be mounted (confirms CommandCenter is rendered)
  await page.waitForSelector('.kpi-row-layout', { timeout: 25000 });
  
  // 2. Wait for the Daybook loading spinner to disappear
  await page.waitForFunction(
    () => !document.body.innerText.includes('Synchronizing Daybook metrics...'),
    { timeout: 25000 }
  );

  // Extra wait to let animations and API calls settle
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 3000)));

  // Log details about page content and element counts
  const pageInfo = await page.evaluate(() => {
    const glassCards = document.querySelectorAll('.glass-card').length;
    const taskCards = document.querySelectorAll('.task-card-grid').length;
    const bodyText = document.body.innerText;
    const kpiTexts = Array.from(document.querySelectorAll('.kpi-row-layout .glass-card')).map(el => el.innerText.replace(/\n/g, ' '));
    return { glassCards, taskCards, kpiTexts, bodySummary: bodyText.slice(0, 800) };
  });
  console.log('PAGE CONTENT INFO:', pageInfo);

  console.log('Capturing Desktop view...');
  await page.screenshot({
    path: path.join(brainDir, 'desktop_screenshot.png'),
    fullPage: false
  });

  console.log('Capturing KPI Row...');
  const kpiEl = await page.$('.kpi-row-layout');
  if (kpiEl) {
    await kpiEl.screenshot({ path: path.join(brainDir, 'kpi_row_screenshot.png') });
  } else {
    console.log('⚠️ KPI Row element not found!');
  }

  console.log('Capturing Widget Row...');
  const widgetEl = await page.$('.widget-row-layout');
  if (widgetEl) {
    await widgetEl.screenshot({ path: path.join(brainDir, 'widget_row_screenshot.png') });
  } else {
    console.log('⚠️ Widget Row element not found!');
  }

  console.log('Capturing Task Card...');
  const cardEl = await page.$('.task-card-grid');
  if (cardEl) {
    // Take screenshot of the parent container of task-card-grid (.glass-card)
    const cardParent = await page.evaluateHandle(el => el.closest('.glass-card'), cardEl);
    await cardParent.asElement().screenshot({ path: path.join(brainDir, 'task_card_screenshot.png') });
  } else {
    console.log('⚠️ Task card element not found!');
  }

  console.log('Capturing Mobile View (switching viewport)...');
  await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 3000)));
  
  await page.screenshot({
    path: path.join(brainDir, 'mobile_screenshot.png'),
    fullPage: false
  });

  console.log('Done! All screenshots captured.');
  await browser.close();
}

run().catch(err => {
  console.error('Fatal error during screenshot execution:', err);
  process.exit(1);
});
